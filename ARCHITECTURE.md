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

### 2.1 The four Supabase clients (packages/db)

| Client          | Key                        | Used for |
| --------------- | -------------------------- | -------- |
| `client.ts`     | anon key                   | Auth flows, user-owned data (wishlist, addresses), realtime |
| `server.ts`     | anon key + cookie session  | Server Components / route handlers acting AS the user (@supabase/ssr) |
| `admin.ts`      | service_role key           | Server-only system ops that bypass RLS. `import "server-only"` — NEVER in client components |
| `public.ts`     | anon key, no cookies       | Public catalog reads in Server Components. No session, so pages using it can be ISR-cached. Never for user-specific data |

### 2.2 Where features run

| Feature                     | Where            | Why |
| --------------------------- | ---------------- | --- |
| Login / signup / OAuth      | Client           | Native supabase-js auth |
| Catalog, product detail     | Server (RSC+ISR) | SEO, caching, public reads |
| Search                      | Server           | FTS/unaccent SQL |
| Wishlist, addresses         | Client           | Own rows, RLS-enforced |
| Reviews & replies           | Server route     | `is_brand_reply` must be unforgeable |
| **Order submission**        | **Server only**  | Guest or signed in. Prices re-fetched from DB; voucher validated; atomic RPC `place_order()` callable by service_role ONLY (the order route). Client totals NEVER trusted |
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
| profiles | SELECT own; UPDATE name + phone only | `is_admin`: server only |
| customers (per phone) | No direct access | Server only — counters + blacklist |
| reviews, review_replies | SELECT visible rows | Server route |
| vouchers, voucher_uses, loyalty_gifts, loyalty_awards, rate_limits | No direct access | Server only |

Admin authenticates via Supabase Auth with an `admin` role claim; all admin mutations go through server routes using the admin client.

### 2.4 Identity: account vs customer (decided 2026-09-26)

Two separate identities. Orders connect them.

```
  ACCOUNT  (optional — only if they sign up / log in)
  auth.users ──1:1── profiles (full_name, phone UNIQUE, is_admin)
                        ├── addresses   (saved delivery addresses)
                        ├── wishlists
                        └── reviews / review_replies
                        ▲
                        │ orders.user_id   ← NULL for guests, set when logged in
                     ORDERS  ── order_items, order_status_history
                        │ orders.phone     ← ALWAYS set, normalized (0901234567)
                        ▼
  CUSTOMER  (always — created by the first order from a phone)
  customers (phone PK, delivered_count, refusal_count, is_blacklisted)
                        ├── loyalty_awards
                        └── voucher_uses (first-5, promo once)
```

- **Account = convenience:** saved addresses, wishlist, reviews, "My orders", checkout pre-fill. Login is never required to order (§8.2).
- **Customer (phone) = rules:** first-5 discount, promo once, loyalty, refusals, blacklist — keyed on `orders.phone` ONLY. Logging in changes none of them.
- A logged-in user ordering to someone else's phone: the order is in *their* history (`user_id`), but discounts/loyalty count on the *recipient's* phone. Accepted trade-off of phone-only rules.
- **"My orders" = orders with `user_id = auth.uid()` only** (already what `orders_select_own` RLS allows). Guest orders placed before signing up are NOT linked to the account, even if the profile phone matches — `profiles.phone` is self-typed, so matching on it would let anyone read another person's orders and address. Linking past guest orders would need SMS/OTP phone verification (per-message cost); not planned unless the client asks.
- Guests reach a past order only via the confirmation email / order lookup (order number + phone) — see TODO.md.

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
2. Order form: full name, phone, street address, ward/commune, city/province, secondary phone, email, note, voucher code. Province = one of Vietnam's 34 units since 1 July 2025 (searchable list, `apps/storefront/src/lib/provinces.ts`); districts no longer exist, so `orders.district` stays NULL. Field rules live in `lib/checkout-validation.ts`, run live in the form AND again in the server action.
3. Server route validates voucher, recomputes ALL prices from DB, calls `place_order()`.
4. Customer gets Resend confirmation email; client gets Telegram + email alert.
5. Client calls to confirm (standard VN COD practice) → `confirmed` → `shipped` → `delivered`.
6. Cancel/refusal → stock restored, refusals tracked.

Order numbers: `PZ-YYYY-NNNN` from a Postgres sequence (concurrency-safe, 4+ digits).

---

## 5. Voucher & Loyalty Rules

### First-5-orders voucher (auto)
- Eligibility at placement: count of that **phone's** orders NOT IN (`cancelled`, `delivery_failed`) < 5 — guest or signed in, phone only.
- Cancelled/refused orders release their slot (`voucher_uses.released_at`).
- 10% auto-applied. If customer enters a promo code too, apply the BETTER of the two — no stacking (Shopee-style).
- Promo codes are redeemable ONCE per customer (enforced by a partial unique index on `voucher_uses`); a released slot frees the code again. `auto_first5` is exempt — it applies to all 5 qualifying orders.
- Discount cap: PENDING client decision.

### Loyalty program
- Counter = lifetime `customers.delivered_count` for the order's **phone**. Never resets.
- Gift triggered at every multiple of 10 (10, 20, 30, …) → row in `loyalty_awards`.
- Gift randomly selected from active `loyalty_gifts`. Empty pool → award banked with `gift_id = NULL`, fulfilled when pool refills.
- Fulfillment method: PENDING client decision (recommend bundling with next order).

---

## 6. Fraud Prevention (COD)

- **Customer identity = normalized phone** (`normalize_vn_phone()`: VN mobile, `0xxxxxxxxx`), for guests and accounts alike — every per-customer rule (first-5, promo once, loyalty, refusals, blacklist) keys on it ONLY, so switching guest ↔ account dodges nothing. Phone is also unique per account.
- Abuse limits inside `place_order()`: max 20 units per order, max 3 open `pending` orders per phone (row-locked per phone, so not raceable).
- `pending → confirmed` phone call verifies every order before shipping.
- `delivery_failed` increments `customers.refusal_count`; client can set `customers.is_blacklisted` (blocks new orders from that phone at `place_order()`, whatever format it's typed in).
- Order endpoint rate-limited per phone and IP: `hit_order_rate_limit()` (service role only), called by the order route before `place_order()` as a separate statement so rejected orders still count. Every attempt that passes form validation counts; 1-hour fixed windows, 5 per normalized phone, 10 per IP (IPv6 per /64, IPv4-mapped unwrapped). IP = `x-real-ip` / first `x-forwarded-for`, trustworthy only because Vercel overwrites them; no IP → phone limit only. Shared mobile-carrier IPs (CGNAT) are why the IP limit is loose. A residential-proxy botnet is not stopped by this — the confirmation call is the backstop.

---

## 7. Database Schema (21 tables)

| Table | Key fields | Notes |
| ----- | ---------- | ----- |
| products | id, name, slug, description, category_id, care_instructions, size_guide, is_active | `size_guide` jsonb (nullable): `{ "sizes": ["S","M"], "rows": [{ "label": "Chest (cm)", "values": ["52","55"] }] }` — one string per size, units in the label |
| product_variants | product_id, color, size, price, original_price, stock, sku | Stock lives HERE |
| product_images | product_id, color (nullable), storage_path, sort_order, is_primary | Supabase Storage. Images belong to a COLORWAY, not a variant — `color` matches `product_variants.color`; NULL = general image |
| categories | id, name, slug, sort_order | |
| profiles | id (FK auth.users), full_name, phone UNIQUE, is_admin | Optional — guests have none |
| customers | phone PK (normalized), delivered_count, refusal_count, is_blacklisted | One row per phone, created on first order. Identity for all per-customer rules |
| addresses | user_id, name, phone, address, ward, district, city, is_default, label | |
| orders | order_number (PZ-YYYY-NNNN, sequence), user_id (NULL = guest), phone (normalized), address snapshot fields, status enum, subtotal, discount, total, note, timestamps | Address is SNAPSHOTTED, not FK-only |
| order_items | order_id, product_id, variant_id, name_snapshot, price_snapshot, qty, image_snapshot | Frozen at order time |
| reviews | user_id, product_id, rating 1–5, content, is_visible | No pre-moderation |
| review_replies | review_id, user_id, content, is_brand_reply | Brand flag server-enforced |
| wishlists | user_id, product_id, added_at | |
| vouchers | code, type (auto_first5 / promo), discount_pct, cap_amount, max_uses, used_count, is_active, expires_at | |
| voucher_uses | voucher_id, phone, order_id, voucher_type, released_at (nullable) | Slot released on cancel/refusal. `voucher_type` is denormalised from `vouchers.type` so the one-promo-per-phone partial unique index can exist |
| bundles | name, discount_amount, is_active | |
| bundle_items | bundle_id, product_id | |
| collections | name, slug, sort_order, is_active | |
| collection_items | collection_id, product_id, sort_order | |
| loyalty_gifts | name, description, image_url, is_active | |
| loyalty_awards | phone (FK customers), gift_id (nullable), milestone, status (pending / fulfilled) | Survives empty pool |
| rate_limits | bucket ('ip:…' / 'phone:…'), window_start, hits | Order attempt counters; rows older than the previous window are pruned on each call |

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
2. ~~Guest checkout vs account required~~ — **RESOLVED 2026-09-26: guest checkout allowed, no account required.** Accounts stay optional (history, addresses, wishlist, reviews). The schema still assumes accounts (`orders.user_id not null`, `AUTH_REQUIRED`, voucher/loyalty/blacklist keyed on `profiles`); the guest-safe changes are listed under the Order form task in TODO.md and land with it.
3. Voucher discount cap amount.
4. Loyalty gift notification method + fulfillment method.
5. Loyalty progress visibility on account page.
6. Sanity CMS vs site_content table in admin (recommendation: drop Sanity).
7. Announcement bar management (hardcoded for now).

## 9. Out of Scope

Payment gateways, Shopee integration, newsletter/email marketing, mobile apps, multi-language, multi-admin roles, analytics dashboards.