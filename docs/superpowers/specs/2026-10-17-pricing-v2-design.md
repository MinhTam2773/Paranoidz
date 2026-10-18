# Pricing v2 — database design

Date: 2026-10-17 · Status: **draft, waiting on the owner's review** · Rules: ARCHITECTURE.md §5 "Pricing v2" (decided by the client the same day).

This covers the database and server side only. The checkout voucher picker, the label rename and the gift / free-shipping display are storefront UI and belong to the client (Tủn's agent); this design ends with the API shape he builds against.

## What exists today (master `77a132f`)

- `vouchers` (`type` enum `auto_first5` | `promo`, `discount_pct`, `cap_amount`, `max_uses`, `used_count`, `expires_at`, `is_active`).
- `voucher_uses`: one row per order (`unique (order_id)`); a promo is once per phone (partial unique index `voucher_uses_one_promo_per_phone`). A cancel or refusal releases **every** row of the order and decrements each voucher's `used_count`, so several codes per order already work there.
- `order_discount(phone, subtotal, counts, voucher_code, items)`: first-5 vs promo vs bundle → best wins, then the flash % on the picked lines **added to `discount`**.
- `quote_order()` and `place_order()` both call it. `orders_total_math`: `total = subtotal − discount + shipping_fee`.

## Decisions to approve

**D1. What counts as "clothing" (free shipping and gift).**
New column `products.is_clothing boolean not null default true`, set in the product editor ("Tính là áo: freeship / quà tặng"). The client unticks it for socks and gifts. The default is true because almost every product is a shirt.
*Alternative:* a flag per category. It's fewer clicks once categories exist, but categories are empty today, and a product without a category would silently not count.

**D2. The gift.**
New column `product_variants.is_order_gift boolean not null default false`, with a partial unique index so at most one variant is the gift. The client ticks it on the socks' "Màu Ngẫu Nhiên" variant.
- `place_order()` adds an `order_items` row with `is_gift = true`, `price_snapshot = 0` and `qty = 1` when the order has ≥ 1 clothing item.
- Stock is taken with the same atomic guard as other lines (`where stock >= 1`).
- **If the gift is out of stock, the order still goes through without it** and `orders.gift_missing = true` shows in the admin. Free socks shouldn't block a sale.

**D3. The flash sale becomes the item price.**
- `order_items.price_snapshot` holds the price actually charged (the flash price inside a window).
- New column `list_price_snapshot` keeps the normal price, for the struck-out price and for reports.
- `subtotal` = the sum of charged prices. The flash sale no longer goes into `discount`.

**D3b. A window that ends during checkout.**
The customer sees the flash price, the window closes, then they press Đặt hàng. The checkout action passes the total the customer was shown, as `p_expected_total`. If `place_order()` computes a different total, it raises `PRICE_CHANGED` before any stock changes. The page then shows the new price and asks again. This is the same behaviour as Shopee: the price is the one at the moment of ordering, and the customer is never charged a price they didn't see.

**D4. Vouchers.**
- **New voucher type `standing`** (enum value): usable on every order, never once-per-phone (the once-per-phone index only covers `promo`). "Khách mua lần đầu" is one `standing` voucher: 10 %, a code aT picks (e.g. `LANDAU`).
- **New column `vouchers.is_listed boolean not null default false`**: listed codes appear in the checkout picker; unlisted ones must be typed in (campaign codes, later the `pdz…` reward codes).
- **`voucher_uses`**: drop `unique (order_id)` and add `unique (order_id, voucher_id)`. One row per applied code.
- **AUTO-FIRST5 retires** in the same migration that creates "lần đầu": `is_active = false`, row kept because old orders reference it. The first-5 counting code leaves `order_discount()`. The `auto_first5` enum value stays (Postgres can't drop enum values easily).
- **Codes per order:** at most one `standing` plus one `promo` (`TOO_MANY_VOUCHERS` otherwise) until aT answers how many campaign codes may stack.

**D5. Order of steps and rounding** (each step works on what the previous left):
1. **Lines at the charged price** → `subtotal`.
2. **Combo:** `best_bundles()` on the unit counts, flash items included, capped at `subtotal`.
3. **Vouchers, one after another:** the `standing` one first, then the `promo`. Each takes `floor(remaining × pct / 100)`, then its own `cap_amount`.
4. **`discount` = combo + vouchers.**
5. **Shipping:** `shipping_fee` = the SPX / table fee as today. New column `orders.shipping_discount` = that fee when delivery is standard and clothing units ≥ 2, else 0. This is the full fee until aT answers whether free shipping is capped. Express never gets free shipping.
6. **Constraint:** `total = subtotal − discount + shipping_fee − shipping_discount`. Old rows are valid with `shipping_discount` defaulting to 0.
7. **Gift line** (D2).

**D6. Function signatures** (every signature change: drop the old one, then revoke from `public, anon, authenticated` and grant to `service_role` on the new one; LESSONS § Workflow):
- `order_discount(p_phone, p_subtotal, p_counts, p_voucher_codes text[], p_items)` returns `{combo, bundles, vouchers: [{id, code, type, pct, amount}], discount}`.
- `quote_order(p_items, p_phone, p_voucher_codes text[], p_delivery_method)` additionally returns:
  - `available_vouchers`: listed, active, not expired, not used up, not already used by this phone if `promo`. This feeds the picker.
  - `free_shipping` (bool) and `gift` (bool, plus whether it's in stock).
  - `voucher_errors`: one entry per code that doesn't apply, priced without it, like today.
- `place_order(…, p_voucher_codes text[]` (replaces `p_voucher_code`)`, p_delivery_method, p_expected_total numeric default null)`.
- **No 10 % gap while the picker doesn't exist:** until Tủn's picker ships, the checkout action sends the standing code itself, plus any typed code. Customers keep their 10 % from the moment v2 deploys.

## Zones

- **RED:**
  - Every migration.
  - `order_discount` / `quote_order` / `place_order`.
  - `apps/storefront/src/app/checkout/actions.ts`.
  - `packages/db/src/types.ts`.
  - The admin promo-code actions (new type and "listed" flag change what customers pay).
- **YELLOW:** the admin product-editor checkbox (`is_clothing`) and gift-variant toggle (their server actions validate them), and the smoke / e2e updates.
- **GREEN:** admin label copy, docs.
- **Client:** checkout picker, "Ưu đãi 5 đơn đầu" → "Khách mua lần đầu", gift and free-shipping lines, product-page flash price.

## PR plan

Every PR: smoke cases, migration test → smoke → prod, then merge (`master` is protected).

1. **PR A (RED, schema only, no behaviour change):**
   - New columns and their defaults.
   - The `standing` enum value.
   - The `voucher_uses` unique swap.
   - The constraint with `shipping_discount` defaulting to 0.

   Nothing reads the new columns yet, so it's safe to ship alone.
2. **PR B (YELLOW + a little RED):** admin fields.
   - "Tính là áo" checkbox.
   - Gift-variant toggle.
   - On the promo-code form: "Hiện trong danh sách chọn mã" and type "Dùng mọi đơn".
3. **PR C (RED, the big one):**
   - `order_discount` / `quote_order` / `place_order` v2.
   - The checkout action, sending the standing code by default.
   - The migration also inserts the "lần đầu" voucher and deactivates AUTO-FIRST5.
   - Rewrites the first-5 smoke cases (1, 2, 17, the bundle-vs-promo case), plus e2e S3 / S4 / A3.

   Quote and order must change together, so this is one PR. The migration goes on prod right before the merge.
4. **Hand-off:** the `quote_order` response shape and the action's input go to Tủn for the picker.

## Questions for the owner

1. D1: a flag per product (recommended) or per category?
2. D2: when the gift is out of stock, skip it and flag the order (recommended), or refuse the order?
3. D3b: refuse with `PRICE_CHANGED` when the total moved (recommended), or charge the new price silently?
4. The code for "Khách mua lần đầu": ask aT (e.g. `LANDAU`).
