# ARCHITECTURE.md — Paranoidz E-Commerce

> Source of truth for system design. Distilled from Project Proposal v2.1.
> Agents: read this before touching the database, server routes, or any money/stock/voucher logic.

---

## 1. System Overview

Self-contained headless e-commerce for a Vietnamese streetwear brand. COD only — no payment gateway. Customer browses → submits order form → client creates the SPX shipment (no confirmation call, decided 2026-10-16) → SPX delivers and collects cash.

| Layer               | Technology                       |
| ------------------- | -------------------------------- |
| Storefront          | Next.js (App Router) — paranoidz.vn |
| Admin               | Next.js (App Router) — admin.paranoidz.vn |
| Database & Auth     | Supabase (PostgreSQL, Pro plan, Singapore) |
| File storage        | Supabase Storage (product images) |
| Search              | Postgres FTS + `unaccent` (diacritic-insensitive Vietnamese) |
| Transactional email | Resend (customer confirmations + client alerts) |
| Notifications       | Zalo Bot Platform (client new-order alerts) |
| Hosting             | Vercel (sin1), two projects from one monorepo |

UI language: **Vietnamese only**, storefront and admin (decided 2026-10-01; see CLAUDE.md §5).

Auth providers: email/password, Google, Facebook. Phone number required and **unique** per account, stored normalized (`profiles_phone_normalized`). Email signup sends it as metadata (`handle_new_user()`); OAuth accounts, or a signup phone another account already has, get it at `/account/phone`, which every login passes through.

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
| Search                      | Server           | `search_products(q)` (FTS + unaccent, security invoker → active only): name > category + variant colours > description, every word must prefix-match. Built per query, not indexed — fine at tens–hundreds of products; add a maintained search column + GIN index if the catalog grows into thousands |
| Wishlist                    | Client           | Own rows, RLS-enforced |
| Addresses                   | Server actions, as the user | Own rows, RLS-enforced (server client, not admin); running server-side lets the checkout field rules (`lib/checkout-validation.ts`) be enforced and phones stored normalized. Max 10 per account; first one is the default |
| Reviews & replies           | Server route     | `is_brand_reply` must be unforgeable |
| **Order submission**        | **Server only**  | Guest or signed in. Prices re-fetched from DB; voucher validated; atomic RPC `place_order()` callable by service_role ONLY (the order route). Client totals NEVER trusted |
| Voucher validation          | Server only      | Client never computes its own discount |
| Order status changes        | Server only      | Stock restore + loyalty counter must be atomic |
| Guest order lookup          | Server only      | Order number + phone, rate limited; returns status, items, totals, ward/city only — no name, street, phones, email or note (order numbers are sequential, so a known phone + guessing must not reveal an address) |
| Loyalty gift trigger        | Server / DB      | Counter math, pool selection |
| Admin realtime order feed   | Client (admin)   | RLS restricts channel to admin role |

### 2.3 RLS posture

| Tables | Customer access | Writes |
| ------ | --------------- | ------ |
| products, product_variants, product_images, categories, collections, bundles | Public SELECT (active rows) | Admin server routes only |
| wishlists, addresses | Full CRUD own rows (`user_id = auth.uid()`) | Wishlists client-side; addresses via `app/account/actions.ts` acting as the user. RLS-enforced either way |
| orders, order_items | SELECT own rows | Server only — NO client INSERT/UPDATE policy exists |
| profiles | SELECT own; UPDATE name + phone only | `is_admin`: server only |
| customers (per phone) | No direct access | Server only — counters + blacklist |
| reviews, review_replies | SELECT visible rows | Server route |
| vouchers, voucher_uses, loyalty_gifts, loyalty_awards, rate_limits | No direct access | Server only |

Admin authenticates via Supabase Auth; admin status is `profiles.is_admin`, read server-side on every admin request (`apps/admin/src/proxy.ts`, plus `requireAdmin()` before any service_role use) — no JWT claim, so revoking it takes effect on the next request (decided 2026-10-01). All admin mutations go through server routes using the admin client.

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
- **Admin stock writes** (the only other writers): `set_variant_stocks()` — compare-and-set (`WHERE stock = expected`, all or nothing), used by the product editor and the BigSeller import; `adjust_variant_stock()` — +/- on the inventory page (`WHERE stock + delta >= 0`), logged in `stock_adjustments` in the same transaction. A brand-new variant may be inserted with its initial stock.
- Never let an agent "simplify" this into check-then-write — that reintroduces the race condition.

### 3.1 BigSeller sync (file-based) — decided 2026-10-12

The client runs Shopee (2 shops) and TikTok Shop through BigSeller, which holds the **master stock count** and pushes it to the marketplaces. The website can't receive that push (only authorized marketplace stores can), and BigSeller's Open API is deferred until after launch, so the two are kept in step with Excel files moved by hand (spec: `docs/superpowers/specs/2026-10-12-bigseller-inventory-sync-design.md`).

- **BigSeller → website** (admin `/inventory/import`): the Inventory List export sets each matching variant to
  `stock = max(0, available − unsent_out + unsent_back + unsent_adj)` through `set_variant_stocks()`, where the three numbers come from `bigseller_unsent()`: units in orders not yet exported (pending included), units in exported orders that were then cancelled / refused, and unexported adjustments. A file generated before the last export batch was marked sent is rejected (its export time is in the file name, UTC). Unknown SKUs become **hidden** new products (price = 70 % of the pdz01-SP Shopee promotion price, rounded down to ₫1.000, from BigSeller's Shopee listings export; "Giá gốc" = that Shopee price; both editable).
- **Website → BigSeller** (admin `/inventory/export`): confirmed / shipped / delivered orders not yet exported and negative adjustments go out as a **stock-out** file; exported orders later cancelled / refused and positive adjustments as a **stock-in** file (BigSeller's own template headers). "Đã nhập vào BigSeller" calls `mark_bigseller_sent()` with exactly the ids in the downloaded files. The website never sends absolute stock numbers (BigSeller's inventory import can't set quantities anyway).
- Rule for the client: record each physical stock change in **one** place — on the website (it reaches BigSeller through the export) or in BigSeller (it reaches the website through the next import).

---

## 4. Order Lifecycle

| Status            | Meaning                                   | Stock effect            | Set by |
| ----------------- | ----------------------------------------- | ----------------------- | ------ |
| `pending`         | Submitted, awaiting SPX shipment (admin: "Đã tiếp nhận") | Decremented (atomic) | System |
| `confirmed`       | SPX shipment created ("Đã tạo vận đơn")   | —                       | Client (by creating the shipment) |
| `shipped`         | Handed to carrier                         | —                       | Client |
| `delivered`       | Customer received & paid                  | `delivered_count` +1    | Client |
| `cancelled`       | Cancelled before shipping                 | Restored automatically  | Client |
| `delivery_failed` | Customer refused (bom hàng)               | Restored; `refusal_count` +1 | Client |

Valid transitions: pending→confirmed→shipped→delivered; pending/confirmed→cancelled; shipped→delivery_failed. Enforced inside `transition_order_status()` — invalid transitions throw.

### End-to-end flow
1. Customer browses; Buy It Now skips cart, Add to Cart doesn't.
2. Order form: full name, phone, street address, ward/commune, city/province, secondary phone, email, note, voucher code. Province = one of Vietnam's 34 units since 1 July 2025 (searchable list, `apps/storefront/src/lib/provinces.ts`); districts no longer exist, so `orders.district` stays NULL. Field rules live in `lib/checkout-validation.ts`, run live in the form AND again in the server action.
3. Server route validates voucher, recomputes ALL prices from DB (items, discount, shipping fee — §5), calls `place_order()`.
4. Customer gets Resend confirmation email; client gets Zalo + email alert.
5. No confirmation call (client, 2026-10-16: "không muốn làm phiền khách"). The client looks over new orders and creates their SPX shipments — one on the order page, or many at once from `/orders` with the labels printed together (§5 "SPX Open API"). Creating the shipment moves the order `pending → confirmed`; there is no other way to confirm (from then on the order is in the next BigSeller stock-out export, §3.1). SPX picks the parcel up; its tracking webhook moves the order to `shipped` → `delivered` / `delivery_failed` (manual buttons stay as a fallback).
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

### Bundles (combo) — decided 2026-10-07
- A bundle = a set of products + a flat ₫ `discount_amount`. Any variant (size/colour) of each product counts.
- Applies **per complete set**: 2 tees + 2 caps in a tee+cap bundle = discount ×2.
- **Each unit counts toward one bundle only.** When bundles overlap, `place_order()` picks the combination of sets that saves the most (`best_bundles()`, exhaustive search — cheap because orders are capped at 20 units).
- **No stacking with vouchers**: the order gets the better of (bundle total) vs (first-5 / promo). A tie goes to the bundle, so the customer keeps their promo use. When the bundle wins, no `voucher_uses` row is written.
- The bundle total is capped at the subtotal. `orders.applied_bundles` snapshots what was applied (`[{bundle_id, name, discount_amount, sets}]`), NULL when no bundle discount priced the order.

### Live checkout price — decided 2026-10-11
- The checkout shows the discount and the total to pay before "Đặt hàng" (client). One rule set: `order_discount(phone, subtotal, counts, code)` holds first-5 vs promo vs bundles; `place_order()` and the read-only `quote_order(items, phone, code)` both call it, so the preview can't drift from the charge.
- No valid phone yet → priced as a new customer (first-5 applies, the page says it is re-checked). A bad code is returned as `voucher_error` with the discount computed without it. Display only: `place_order()` still decides at submit (pending limit, blacklist and stock are checked only there).
- `quoteOrder` server action, rate limited (`quote` scope); on failure the page says "Áp dụng khi đặt hàng".

### Shipping fee — decided 2026-10-09 (resolves §8.1)
- The customer pays shipping at **SPX Express's rates**; no free-shipping threshold. Nationwide.
- Fee = `shipping_fee(city, units)`: parcel weight = **300 g per unit** (client: "mặc định 1 áo là 0.3kg"), looked up in `shipping_rates` for the zone of the delivery province (`shipping_provinces`). Ward doesn't matter (SPX quoted two wards per province identically).
- Zones and rates, from SPX's public estimator (spx.vn/esf-tool) on 2026-10-09, shipping from HCMC — every one of the 34 provinces checked at 1–20 units:

  | Zone | Provinces | ≤ 1 kg | Above 1 kg |
  | ---- | --------- | ------ | ---------- |
  | `hcm` | TP. Hồ Chí Minh | ₫18.000 | +₫2.500 per 500 g |
  | `south` | Đồng Nai, Tây Ninh, Đồng Tháp, Vĩnh Long, Cần Thơ, An Giang, Cà Mau | ₫22.000 | +₫2.500 per 500 g |
  | `other` | the other 26 | ₫22.000 | ₫27.000 to 1.5 kg, ₫30.000 to 2 kg, then +₫5.000 per 500 g |

  1–3 tees (≤ 0.9 kg) — almost every order — pay the flat ₫18.000 / ₫22.000.
- `place_order()` computes it before any stock lock and stores it in `orders.shipping_fee`; `total = subtotal − discount + shipping_fee` (`orders_total_math`). Discounts apply to the subtotal only. Unknown city → `SHIPPING_UNAVAILABLE`.
- Checkout previews the fee as soon as a province is picked (`quoteShipping` server action → `shipping_fee()`, service role). Display only; `place_order()` recomputes.
- The quote is final for the customer. If SPX charges the shop a little differently (account rates, driver re-weighing), the shop absorbs it.
- When SPX changes prices, update `shipping_rates` rows (no code change). Superseded by the live SPX quote ("SPX Open API" below) once that ships; the table stays as its fallback.

### SPX Open API — decided 2026-10-15 (being built on `feat/spx-open-api`)
The client wants SPX's **live** price at checkout (SPX runs promotions, so a fixed table drifts) and to **print the shipping label inside the Paranoidz admin** instead of typing each order on spx.vn. Docs: `https://spx.vn/integration` (guide + API reference).
- **Accounts and keys.** Two pairs, all server-only env vars, never `NEXT_PUBLIC_`, never in git: `SPX_APP_ID` / `SPX_APP_SECRET` (our integration, issued by SPX) and `SPX_USER_ID` / `SPX_USER_SECRET` (the seller account). Production uses the **client's existing SPX account** (its COD payouts and balance live there) — never create a new seller account in production. Test uses an account made with the API's Create Account call on `test-stable.spx.vn`. `SPX_API_HOST` picks the environment.
- **Signing.** Every call is a POST with JSON and headers `app-id`, `timestamp` (seconds), `random-num` (int64), `check-sign` = hex HMAC-SHA256(app-secret, `<app-id>_<timestamp>_<random-num>_<body>`), computed over the exact body string that is sent.
- **Checkout fee.** The storefront server asks SPX's Check Shipping Fee for the delivery address and parcel, with the best currently valid account voucher from List Voucher (SPX promotions arrive as vouchers that only apply when their code is passed). That quote is shown and saved in `orders.shipping_fee`; the same voucher code is sent again when the SPX order is created. If SPX errors or is slow, checkout falls back to `shipping_fee()` (the §5 table), so checkout never blocks on SPX. The customer's quoted fee is final; differences at order creation or re-weighing are the shop's (same rule as §5). Prices stay server-computed: the browser never sends a fee.
  - Built 2026-10-16 (`apps/storefront/src/lib/shipping-quote.ts`): the parcel is priced like the shipment will be created (300 g / unit, COD amount + declared value = subtotal from database prices). The plain price and the voucher prices are separate 2.1 calls (one voucher SPX no longer knows fails a whole batch); SPX does the voucher maths, the cheapest answer wins, a tie keeps no voucher. SPX gets 3 s in total. Vouchers and SPX answers are cached per server instance for 5 minutes, so the fee charged at submit is normally the one the preview showed (a preview that fell back to the table may still be charged SPX's fee at submit, or the reverse; the confirmation shows what was charged).
  - `place_order(p_shipping_fee, p_spx_voucher)`: NULL fee = the table; otherwise a whole amount within 0 … 3 × the table fee, else `INVALID_SHIPPING_FEE` (the server falls back to the table before that). Still service-role only. The voucher is stored in `orders.spx_voucher` only with a fee. When creating the shipment, a voucher SPX refuses by then (expired, min spend) is dropped and the shipment created without it.
  - Previews (`previewShipping`) are rate limited per IP (§6, `shipping` scope, 60 / hour); over the limit the table fee is shown.
- **Addresses.** SPX needs its own province / ward names (2-level address, `address_version` 2). Checkout's ward becomes a picker of SPX's ward list for the chosen province (the free-text ward goes). Orders placed before that keep their typed ward; the admin picks the matching SPX ward when creating the shipment. Built 2026-10-16: checkout and the address book share the picker (province first, ward disabled until then); `placeOrder` and `saveAddress` refuse a ward that isn't in `spx_locations` for the province. A saved address with a typed ward is matched to SPX's name (accents, case and the "Phường" / "Xã" prefix ignored) or left empty for the customer to pick; the stored address only changes when the customer saves it.
- **Fulfilment.** For a `pending` order (or a `confirmed` one from before 2026-10-16 without a shipment), the admin order page offers **Tạo đơn SPX**: pick an SPX pickup slot, then create the order — sender = the shop (pickup address in `SPX_SENDER_*` env), receiver = the order snapshot, COD amount = `orders.total`, payment role = sender pays, weight = 0.3 kg × units, declared value = subtotal (high-value service only at ≥ ₫3.000.000), our order number as SPX's `order_id`. SPX returns a tracking number, stored on the order. **In phiếu** asks SPX for the label link on each click (it is valid 30 minutes / 10 opens — never stored) and opens it for printing. Creating the shipment confirms a `pending` order (if that status change fails, the shipment stays and the webhook moves the order on). Cancelling an order that has an SPX shipment cancels the shipment too.
- **Bulk (2026-10-16).** On `/orders`, the Đã tiếp nhận tab takes up to 20 ticked orders, one pickup slot, and **Tạo đơn SPX & in phiếu**: each order is created as above with its typed ward matched to SPX's list (no match → skipped, created from its own page), then one label call returns the labels of every new shipment. The Đã tạo vận đơn tab reprints ticked orders' labels.
- **Status.** SPX's tracking webhook (`apps/storefront/src/app/api/spx/webhook/route.ts`) moves orders to `shipped` / `delivered` / `delivery_failed` through `transition_order_status()`; the manual buttons stay as a fallback.
- **One shipper per order.** Website orders get SPX shipments only from our admin; BigSeller keeps handling Shopee / TikTok orders. Never both for the same order.

### Loyalty program
- Counter = lifetime `customers.delivered_count` for the order's **phone**. Never resets.
- Gift triggered at every multiple of 10 (10, 20, 30, …) → row in `loyalty_awards`.
- Gift randomly selected from active `loyalty_gifts`. Empty pool → award banked with `gift_id = NULL`, fulfilled when pool refills.
- Fulfillment method: PENDING client decision (recommend bundling with next order).

---

## 6. Fraud Prevention (COD)

- **Customer identity = normalized phone** (`normalize_vn_phone()`: VN mobile, `0xxxxxxxxx`), for guests and accounts alike — every per-customer rule (first-5, promo once, loyalty, refusals, blacklist) keys on it ONLY, so switching guest ↔ account dodges nothing. Phone is also unique per account.
- Abuse limits inside `place_order()`: max 20 units per order, max 3 open `pending` orders per phone (row-locked per phone, so not raceable).
- No confirmation call since 2026-10-16 (client: don't disturb customers). Accepted trade-off: fake COD orders and addresses SPX doesn't serve are no longer caught by a call; what remains is the rate limits, the blacklist, the 20-unit cap and the client looking at each order before creating its shipment. A refused parcel costs the shop SPX's return fee.
- `delivery_failed` increments `customers.refusal_count`; client can set `customers.is_blacklisted` (blocks new orders from that phone at `place_order()`, whatever format it's typed in).
- Order and order-lookup endpoints rate-limited per phone and IP: `apps/storefront/src/lib/rate-limit.ts` → `hit_rate_limit(scope, …)` (service role only), called before any order / lookup work as a separate statement so rejected attempts still count. Every attempt that passes form validation counts; 1-hour fixed windows, separate counters per scope. Orders: 5 per normalized phone, 10 per IP. Lookups: 10 per phone, 20 per IP. Shipping-fee previews (`shipping`, they call SPX): 60 per IP; over it the table fee is shown instead. IPv6 per /64, IPv4-mapped unwrapped. IP = `x-real-ip` / first `x-forwarded-for`, trustworthy only because Vercel overwrites them; no IP → phone limit only. Shared mobile-carrier IPs (CGNAT) are why the IP limits are loose. A residential-proxy botnet is not stopped by this — the client reviewing new orders before creating shipments is the backstop.

---

## 7. Database Schema (24 tables)

| Table | Key fields | Notes |
| ----- | ---------- | ----- |
| products | id, name, slug, description, category_id, care_instructions, size_guide, is_active | `size_guide` jsonb (nullable): `{ "sizes": ["S","M"], "rows": [{ "label": "Chest (cm)", "values": ["52","55"] }] }` — one string per size, units in the label |
| product_variants | product_id, color, size, price, original_price, stock, sku | Stock lives HERE. `sku` unique, NFC-normalised (check `product_variants_sku_nfc`) — must equal BigSeller's SKU |
| product_images | product_id, color (nullable), storage_path, sort_order, is_primary | Supabase Storage. Images belong to a COLORWAY, not a variant — `color` matches `product_variants.color`; NULL = general image |
| categories | id, name, slug, sort_order | |
| profiles | id (FK auth.users), full_name, phone UNIQUE (normalized, NULL until the phone step), is_admin | Optional — guests have none |
| customers | phone PK (normalized), delivered_count, refusal_count, is_blacklisted | One row per phone, created on first order. Identity for all per-customer rules |
| addresses | user_id, name, phone, address, ward, district, city, is_default, label | |
| orders | order_number (PZ-YYYY-NNNN, sequence), user_id (NULL = guest), phone (normalized), address snapshot fields, status enum, subtotal, discount, shipping_fee (§5), total (= subtotal − discount + shipping_fee), applied_bundles (jsonb, §5), note, bigseller_exported_at, bigseller_restocked_at (§3.1), spx_tracking_no / spx_ward / spx_fee / spx_created_at / spx_voucher (§5 "SPX Open API"), timestamps | Address is SNAPSHOTTED, not FK-only |
| order_items | order_id, product_id, variant_id, name_snapshot, color_snapshot, size_snapshot, price_snapshot, image_snapshot, sku_snapshot, qty | Frozen at order time |
| stock_adjustments | variant_id (set null on delete), sku_snapshot, delta (≠ 0), reason, created_by, created_at, exported_at | +/- from the inventory page, sent to BigSeller (§3.1). RLS on, no policies |
| reviews | user_id, product_id, rating 1–5, content, is_visible | No pre-moderation |
| review_replies | review_id, user_id, content, is_brand_reply | Brand flag server-enforced |
| wishlists | user_id, product_id, added_at | |
| vouchers | code, type (auto_first5 / promo), discount_pct, cap_amount, max_uses, used_count, is_active, expires_at | |
| voucher_uses | voucher_id, phone, order_id, voucher_type, released_at (nullable) | Slot released on cancel/refusal. `voucher_type` is denormalised from `vouchers.type` so the one-promo-per-phone partial unique index can exist |
| bundles | name, discount_amount, is_active | Pricing rules in §5 |
| bundle_items | bundle_id, product_id | |
| collections | name, slug, sort_order, is_active | |
| collection_items | collection_id, product_id, sort_order | |
| loyalty_gifts | name, description, image_url, is_active | |
| loyalty_awards | phone (FK customers), gift_id (nullable), milestone, status (pending / fulfilled) | Survives empty pool |
| shipping_provinces | city PK (the 34 names in `lib/provinces.ts`), zone (hcm / south / other) | §5. RLS on, no policies — read via `shipping_fee()` |
| shipping_rates | zone, max_grams, fee | Tier covers weights ≤ max_grams; 500 g steps to 6 kg (20 units). RLS on, no policies |
| rate_limits | bucket ('order:ip:…' / 'lookup:phone:…'), window_start, hits | Order attempt counters; rows older than the previous window are pruned on each call |

### Required Postgres objects
- Enum: `order_status` (6 values above).
- Sequence + helper for `order_number`.
- `place_order(...)` — SECURITY DEFINER, full transaction per section 3.
- `shipping_fee(city, units)` — service role only; raises `SHIPPING_UNAVAILABLE` (§5).
- `order_discount(...)` — internal (no grants), the discount rules shared by `place_order()` and `quote_order(...)` (service role only) (§5).
- `transition_order_status(order_id, new_status)` — SECURITY DEFINER: validates transition, restores stock, bumps counters, creates loyalty awards.
- `set_variant_stocks(changes)` / `adjust_variant_stock(variant, delta, reason)` — admin stock writes (§3). `rename_product_color(product, from, to)` — renames a colour on its variants and photos together.
- `bigseller_unsent()` / `mark_bigseller_sent(out, back, adjustments)` — service role only, the BigSeller sync bookkeeping (§3.1).
- Extension: `unaccent` (`immutable_unaccent()` wrapper); `search_products()` for storefront search (§2.2).
- RLS enabled on EVERY table, policies per section 2.3.

---

## 8. Pending Decisions (do NOT implement until resolved)

1. ~~Free shipping: all orders vs orders over ₫1.000.000~~ — **RESOLVED 2026-10-09: no free shipping; the customer pays SPX-rate shipping (§5).**
2. ~~Guest checkout vs account required~~ — **RESOLVED 2026-09-26: guest checkout allowed, no account required.** Accounts stay optional (history, addresses, wishlist, reviews). The schema still assumes accounts (`orders.user_id not null`, `AUTH_REQUIRED`, voucher/loyalty/blacklist keyed on `profiles`); the guest-safe changes are listed under the Order form task in TODO.md and land with it.
3. Voucher discount cap amount.
4. Loyalty gift notification method + fulfillment method.
5. Loyalty progress visibility on account page.
6. Sanity CMS vs site_content table in admin (recommendation: drop Sanity).
7. Announcement bar management (hardcoded for now).

## 9. Out of Scope

Payment gateways, Shopee integration (stock reaches Shopee through BigSeller, §3.1; BigSeller's Open API comes after launch), carrier APIs other than SPX (§5 "SPX Open API"), newsletter/email marketing, mobile apps, multi-language (the site is Vietnamese-only, not bilingual), multi-admin roles, analytics dashboards.