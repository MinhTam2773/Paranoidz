# ARCHITECTURE.md — Paranoidz E-Commerce

> Source of truth for system design. Distilled from Project Proposal v2.1.
> Agents: read this before touching the database, server routes, or any money/stock/voucher logic.

---

## 1. System Overview

Self-contained headless e-commerce for a Vietnamese streetwear brand. COD only — no payment gateway. Customer browses → submits order form → client confirms by phone → delivers and collects cash.

| Layer               | Technology                       |
| ------------------- | -------------------------------- |
| Storefront          | Next.js (App Router) — paranoidz.com |
| Admin               | Next.js (App Router) — admin.paranoidz.com |
| Database & Auth     | Supabase (PostgreSQL, Pro plan, Singapore) |
| File storage        | Supabase Storage (product images) |
| Search              | Postgres FTS + `unaccent` (diacritic-insensitive Vietnamese) |
| Transactional email | Resend (customer confirmations + client alerts) |
| Notifications       | Telegram Bot (client new-order alerts) |
| Hosting             | Vercel (sin1), two projects from one monorepo |

Auth providers: email/password, Google, Facebook. Phone number required and **unique** per account.

---

## 2. Security & Data Access Model

**Guiding rule: reads can be client-side behind RLS; anything touching money, stock, or counters is server-side only.**

### 2.1 The three Supabase clients (packages/db)

| Client          | Key                        | Used for |
| --------------- | -------------------------- | -------- |
| `client.ts`     | anon key                   | Auth flows, user-owned data (wishlist, addresses), realtime |
| `server.ts`     | anon key + cookie session  | Server Components / route handlers acting AS the user (@supabase/ssr) |
| `admin.ts`      | service_role key           | Server-only system ops that bypass RLS. `import "server-only"` — NEVER in client components |

### 2.2 Where features run

| Feature                     | Where            | Why |
| --------------------------- | ---------------- | --- |
| Login / signup / OAuth      | Client           | Native supabase-js auth |
| Catalog, product detail     | Server (RSC+ISR) | SEO, caching, public reads |
| Search                      | Server           | FTS/unaccent SQL |
| Wishlist, addresses         | Client           | Own rows, RLS-enforced |
| Reviews & replies           | Server route     | `is_brand_reply` must be unforgeable |
| **Order submission**        | **Server only**  | Prices re-fetched from DB; voucher validated; atomic RPC. Client totals NEVER trusted |
| Voucher validation          | Server only      | Client never computes its own discount |
| Order status changes        | Server only      | Stock restore + loyalty counter must be atomic |
| Loyalty gift trigger        | Server / DB      | Counter math, pool selection |
| Admin realtime order feed   | Client (admin)   | RLS restricts channel to admin role |

### 2.3 RLS posture

| Tables | Customer access | Writes |
| ------ | --------------- | ------ |
| products, product_variants, product_images, categories, collections, bundles | Public SELECT (active rows) | Admin server routes only |
| wishlists, addresses | Full CRUD own rows (`user_id = auth.uid()`) | Client-side, RLS-enforced |
| orders, order_items | SELECT own rows | Server only — NO client INSERT/UPDATE policy exists |
| profiles | SELECT own; UPDATE name only | `delivered_count`, `refusal_count`, `is_blacklisted`: server only |
| reviews, review_replies | SELECT visible rows | Server route |
| vouchers, voucher_uses, loyalty_gifts, loyalty_awards | No direct access | Server only |

Admin authenticates via Supabase Auth with an `admin` role claim; all admin mutations go through server routes using the admin client.

---

## 3. Stock Management (atomic — non-negotiable)

- **Order placement** is ONE Postgres transaction (`place_order()` function):
  1. For each item: `UPDATE product_variants SET stock = stock - qty WHERE id = $id AND stock >= qty` — if any update touches 0 rows, the whole transaction rolls back and the order is rejected.
  2. Insert `orders` row (number from sequence) + `order_items` with name/price/image snapshots.
  3. Record voucher use if applicable.
- **Stock restoration**: `transition_order_status()` restores quantities automatically when an order moves to `cancelled` or `delivery_failed`. No manual correction.
- **Sold out**: variant with stock 0 is unselectable; product where ALL variants are 0 renders SOLD OUT and cannot be carted.
- Never let an agent "simplify" this into check-then-write — that reintroduces the race condition.

---

## 4. Order Lifecycle

| Status            | Meaning                                   | Stock effect            | Set by |
| ----------------- | ----------------------------------------- | ----------------------- | ------ |
| `pending`         | Submitted, awaiting confirmation call     | Decremented (atomic)    | System |
| `confirmed`       | Client called customer, order verified    | —                       | Client |
| `shipped`         | Handed to carrier                         | —                       | Client |
| `delivered`       | Customer received & paid                  | `delivered_count` +1    | Client |
| `cancelled`       | Cancelled before shipping                 | Restored automatically  | Client |
| `delivery_failed` | Customer refused (bom hàng)               | Restored; `refusal_count` +1 | Client |

Valid transitions: pending→confirmed→shipped→delivered; pending/confirmed→cancelled; shipped→delivery_failed. Enforced inside `transition_order_status()` — invalid transitions throw.

### End-to-end flow
1. Customer browses; Buy It Now skips cart, Add to Cart doesn't.
2. Order form: full name, phone, secondary phone, email, address, note, voucher code.
3. Server route validates voucher, recomputes ALL prices from DB, calls `place_order()`.
4. Customer gets Resend confirmation email; client gets Telegram + email alert.
5. Client calls to confirm (standard VN COD practice) → `confirmed` → `shipped` → `delivered`.
6. Cancel/refusal → stock restored, refusals tracked.

Order numbers: `PZ-YYYY-NNNN` from a Postgres sequence (concurrency-safe, 4+ digits).

---

## 5. Voucher & Loyalty Rules

### First-5-orders voucher (auto)
- Eligibility at placement: count of user's orders NOT IN (`cancelled`, `delivery_failed`) < 5.
- Cancelled/refused orders release their slot (`voucher_uses.released_at`).
- 10% auto-applied. If customer enters a promo code too, apply the BETTER of the two — no stacking (Shopee-style).
- Discount cap: PENDING client decision.

### Loyalty program
- Counter = lifetime `delivered_count`. Never resets.
- Gift triggered at every multiple of 10 (10, 20, 30, …) → row in `loyalty_awards`.
- Gift randomly selected from active `loyalty_gifts`. Empty pool → award banked with `gift_id = NULL`, fulfilled when pool refills.
- Fulfillment method: PENDING client decision (recommend bundling with next order).

---

## 6. Fraud Prevention (COD)

- Phone unique per account — blocks voucher farming via multi-accounts.
- `pending → confirmed` phone call verifies every order before shipping.
- `delivery_failed` increments `refusal_count`; client can set `is_blacklisted` (blocks new orders at `place_order()`).
- Order endpoint rate-limited per phone and IP.

---

## 7. Database Schema (19 tables)

| Table | Key fields | Notes |
| ----- | ---------- | ----- |
| products | id, name, slug, description, category_id, care_instructions, is_active | |
| product_variants | product_id, color, size, price, original_price, stock, sku | Stock lives HERE |
| product_images | product_id, variant_id (nullable), storage_path, sort_order, is_primary | Supabase Storage |
| categories | id, name, slug, sort_order | |
| profiles | id (FK auth.users), full_name, phone UNIQUE, delivered_count, refusal_count, is_blacklisted | |
| addresses | user_id, name, phone, address, ward, district, city, is_default, label | |
| orders | order_number (PZ-YYYY-NNNN, sequence), user_id, address snapshot fields, status enum, subtotal, discount, total, note, timestamps | Address is SNAPSHOTTED, not FK-only |
| order_items | order_id, product_id, variant_id, name_snapshot, price_snapshot, qty, image_snapshot | Frozen at order time |
| reviews | user_id, product_id, rating 1–5, content, is_visible | No pre-moderation |
| review_replies | review_id, user_id, content, is_brand_reply | Brand flag server-enforced |
| wishlists | user_id, product_id, added_at | |
| vouchers | code, type (auto_first5 / promo), discount_pct, cap_amount, max_uses, used_count, is_active, expires_at | |
| voucher_uses | voucher_id, user_id, order_id, released_at (nullable) | Slot released on cancel/refusal |
| bundles | name, discount_amount, is_active | |
| bundle_items | bundle_id, product_id | |
| collections | name, slug, sort_order, is_active | |
| collection_items | collection_id, product_id, sort_order | |
| loyalty_gifts | name, description, image_url, is_active | |
| loyalty_awards | user_id, gift_id (nullable), milestone, status (pending / fulfilled) | Survives empty pool |

### Required Postgres objects
- Enum: `order_status` (6 values above).
- Sequence + helper for `order_number`.
- `place_order(...)` — SECURITY DEFINER, full transaction per section 3.
- `transition_order_status(order_id, new_status)` — SECURITY DEFINER: validates transition, restores stock, bumps counters, creates loyalty awards.
- Extension: `unaccent`; FTS index on products (name + description).
- RLS enabled on EVERY table, policies per section 2.3.

---

## 8. Pending Decisions (do NOT implement until resolved)

1. Free shipping: all orders vs orders over ₫1.000.000 (designs contradict client statement).
2. Guest checkout vs account required (current build assumes account required).
3. Voucher discount cap amount.
4. Loyalty gift notification method + fulfillment method.
5. Loyalty progress visibility on account page.
6. Sanity CMS vs site_content table in admin (recommendation: drop Sanity).
7. Announcement bar management (hardcoded for now).

## 9. Out of Scope

Payment gateways, Shopee integration, newsletter/email marketing, mobile apps, multi-language, multi-admin roles, analytics dashboards.