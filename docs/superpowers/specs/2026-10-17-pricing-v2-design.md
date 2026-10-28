# Pricing v2 — database design

Date: 2026-10-17 · Status: **approved by the owner 2026-10-18** (only the "lần đầu" code is still with aT) · Rules: ARCHITECTURE.md §5 "Pricing v2" (decided by the client the same day).

This covers the database and server side only. The checkout voucher picker, the label rename and the gift / free-shipping display are storefront UI and belong to the client (Tủn's agent); this design ends with the API shape he builds against.

## What exists today (master `77a132f`)

- `vouchers` (`type` enum `auto_first5` | `promo`, `discount_pct`, `cap_amount`, `max_uses`, `used_count`, `expires_at`, `is_active`).
- `voucher_uses`: one row per order (`unique (order_id)`); a promo is once per phone (partial unique index `voucher_uses_one_promo_per_phone`). A cancel or refusal releases **every** row of the order and decrements each voucher's `used_count`, so several codes per order already work there.
- `order_discount(phone, subtotal, counts, voucher_code, items)`: first-5 vs promo vs bundle → best wins, then the flash % on the picked lines **added to `discount`**.
- `quote_order()` and `place_order()` both call it. `orders_total_math`: `total = subtotal − discount + shipping_fee`.

## Decisions (approved 2026-10-18)

**D1. What counts as "clothing" (free shipping and gift).**
New column `products.earns_perks boolean not null default true`, a tick in the admin product editor ("Được freeship & tặng tất"). The client unticks it for socks and gifts. The default is true because almost every product is a shirt. One tick drives both perks: ≥ 1 such item → the gift, ≥ 2 → free shipping. Named for what it does, not "clothing" (owner, 2026-10-18).
*Rejected:* a flag per category (categories are empty today, and a product without a category would silently not count); two separate ticks (nobody asked for it).

**D2. The gift.**
New column `product_variants.is_order_gift boolean not null default false`, with a partial unique index so at most one variant is the gift. The client ticks it on the socks' "Màu Ngẫu Nhiên" variant.
- `place_order()` adds an `order_items` row with `is_gift = true`, `price_snapshot = 0` and `qty = 1` when the order has ≥ 1 `earns_perks` item.
- Stock is taken with the same atomic guard as other lines (`where stock >= 1`).
- **If the gift is out of stock, the order still goes through without it** and `orders.gift_missing = true` shows in the admin. Free socks shouldn't block a sale (owner, 2026-10-18).

**D3. The flash sale becomes the item price.**
- `order_items.price_snapshot` holds the price actually charged (the flash price inside a window).
- New column `list_price_snapshot` keeps the normal price, for the struck-out price and for reports.
- `subtotal` = the sum of charged prices. The flash sale no longer goes into `discount`.

**D3b. A window that ends during checkout.**
The customer sees the flash price, the window closes, then they press Đặt hàng. The checkout action passes the total the customer was shown, as `p_expected_total`. If `place_order()` computes a different total, it raises `PRICE_CHANGED` before any stock changes. The page then shows the new price and asks again. This is the same behaviour as Shopee: the price is the one at the moment of ordering, and the customer is never charged a price they didn't see.
- **The customer must be told why** (owner, 2026-10-18). A flash window has no id per occurrence; it is identified by its start time. `quote_order()` returns `flash_window_start` (`timestamptz`, null outside a window), the page sends it back with the expected total, and on `PRICE_CHANGED` the checkout action re-quotes and returns `{error: "PRICE_CHANGED", reason, old_total, new_total, quote}`:
  - `flash_ended`: the page saw a window, the new quote has none or a different one.
  - `flash_started`: the page saw no window, the new quote has one.
  - `other`: same window, the total moved anyway (SPX fee, a code used up meanwhile).
- `place_order()` only gets `p_expected_total`; the window comparison lives in the action.
- Copy is Tủn's (storefront). Suggested: `flash_ended` → "Flash sale vừa kết thúc, tổng tiền đã thay đổi."; `flash_started` → "Flash sale vừa bắt đầu, bạn được giá tốt hơn!"; `other` → "Tổng tiền vừa thay đổi." Each followed by the new total and the Đặt hàng button again.

**D4. Vouchers.**
- **New voucher type `standing`** (enum value): usable on every order, never once-per-phone (the once-per-phone index only covers `promo`). "Khách mua lần đầu" is one `standing` voucher: 10 %, code **`PDZWELCOME`** (aT, 2026-10-27).
- **New column `vouchers.is_listed boolean not null default false`**: listed codes appear in the checkout picker; unlisted ones must be typed in (campaign codes, later the `pdz…` reward codes).
- **`voucher_uses`**: drop `unique (order_id)` and add `unique (order_id, voucher_id)`. One row per applied code.
- **AUTO-FIRST5 retires** in the same migration that creates "lần đầu": `is_active = false`, row kept because old orders reference it. The first-5 counting code leaves `order_discount()`. The `auto_first5` enum value stays (Postgres can't drop enum values easily).
- **Codes per order: no limit** (aT, 2026-10-27). Each code at most once per order (`voucher_uses` unique per order + voucher); a `promo` stays once per phone. Applied one after another, `standing` first.

**D5. Order of steps and rounding** (each step works on what the previous left):
1. **Lines at the charged price** → `subtotal`.
2. **Combo:** `best_bundles()` on the unit counts, flash items included, capped at `subtotal`.
3. **Vouchers, one after another:** the `standing` one first, then the `promo`. Each takes `floor(remaining × pct / 100)`, then its own `cap_amount`.
4. **`discount` = combo + vouchers.**
5. **Shipping:** `shipping_fee` = the SPX / table fee as today. New column `orders.shipping_discount` = that fee when delivery is standard and `earns_perks` units ≥ 2, else 0. The whole fee, no cap (aT, 2026-10-27). Express never gets free shipping.
6. **Constraint:** `total = subtotal − discount + shipping_fee − shipping_discount`. Old rows are valid with `shipping_discount` defaulting to 0.
7. **Gift line** (D2).

**D6. Function signatures** (every signature change: drop the old one, then revoke from `public, anon, authenticated` and grant to `service_role` on the new one; LESSONS § Workflow):
- `order_discount(p_phone, p_subtotal, p_counts, p_voucher_codes text[], p_items)` returns `{combo, bundles, vouchers: [{id, code, type, pct, amount}], discount}`.
- `quote_order(p_items, p_phone, p_voucher_codes text[], p_delivery_method)` additionally returns:
  - `available_vouchers`: listed, active, not expired, not used up, not already used by this phone if `promo`. This feeds the picker.
  - `free_shipping` (bool) and `gift` (bool, plus whether it's in stock).
  - `voucher_errors`: one entry per code that doesn't apply, priced without it, like today.
  - `flash_window_start` (`timestamptz` or null), for the `PRICE_CHANGED` reason (D3b). Needs a small helper that returns the active window's start (today it lives inside `flash_sale_picks()`).
- `place_order(…, p_voucher_codes text[]` (replaces `p_voucher_code`)`, p_delivery_method, p_expected_total numeric default null)`.
- **No 10 % gap while the picker doesn't exist:** until Tủn's picker ships, the checkout action sends the standing code itself, plus any typed code. Customers keep their 10 % from the moment v2 deploys.

## Zones

- **RED:**
  - Every migration.
  - `order_discount` / `quote_order` / `place_order`.
  - `apps/storefront/src/app/checkout/actions.ts`.
  - `packages/db/src/types.ts`.
  - The admin promo-code actions (new type and "listed" flag change what customers pay).
- **YELLOW:** the admin product-editor checkbox (`earns_perks`) and gift-variant toggle (their server actions validate them), and the smoke / e2e updates.
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
   *Built 2026-10-21 on `feat/pricing-v2-schema`.* Two things the plan missed: `orders_total_math` must keep `gacha_discount` (gacha game, 20261020000001), and dropping `unique (order_id)` makes the `voucher_uses` embed an array, so the admin order page and Excel export changed in the same PR.
2. **PR B (YELLOW + a little RED):** admin fields.
   - "Được freeship & tặng tất" checkbox (`earns_perks`).
   - Gift-variant toggle.
   - On the promo-code form: "Hiện trong danh sách chọn mã" and type "Dùng mọi đơn".
3. **PR C (RED, the big one):**
   - `order_discount` / `quote_order` / `place_order` v2.
   - The checkout action, sending the standing code by default.
   - The migration also inserts the "lần đầu" voucher and deactivates AUTO-FIRST5.
   - Rewrites the first-5 smoke cases (1, 2, 17, the bundle-vs-promo case), plus e2e S3 / S4 / A3.

   Quote and order must change together, so this is one PR. The migration goes on prod right before the merge.
   *Built 2026-10-27 on `feat/pricing-v2-pricing`* (migration `20261027000001_pricing_v2_functions.sql`). Beyond the plan:
   - The flash price is rounded like the storefront's `flashPrice()` (nearest ₫1.000, `flash_unit_price()`). Before v2 the server took `floor(list × pct)` off the total, so a ₫269.000 tee at −10 % showed ₫242.000 and was charged ₫242.100.
   - `place_order()` reads the active window from a new `flash_window()` (start + %), not `active_flash_sale_discount()`.
   - Voucher errors carry the code (`INVALID_VOUCHER:SALE10`), since one order can hold several.
   - The admin order page / SPX card / Excel export, the order email, the Zalo alert, order lookup and the account page show free shipping (net fee) and gift lines, so their sums still add up.
   - **Payment method is still written after the rpc** (Tủn's bank-transfer code). Moving it into `place_order()` is a follow-up, not in PR C.
4. **Hand-off to Tủn** (below): the action shapes for the voucher picker.

## Hand-off: checkout API for the storefront (PR C)

Server actions in `apps/storefront/src/app/checkout/actions.ts`. Today's `CheckoutView` keeps working unchanged (old fields are filled for it), but it can't show free shipping, the gift or several codes. Ship the UI changes **with** PR C, or 2+ shirt orders will show a shipping fee the server doesn't charge.

**`quoteOrder({ items, phone, voucher, vouchers?, deliveryMethod? })`**
- `vouchers`: the codes ticked in the picker. Leave it out and the server uses every listed "Dùng mọi đơn" code (PDZWELCOME). `voucher` (typed) is added on top; a `GACHA-…` code is ignored here.
- Returns the old fields (`subtotal` at list price, `discount` = flash saving + combo + codes, `flashDiscount`, `source`, `code`, `pct`, …) plus:
  - `lines[]`: `{ variantId, qty, listPrice, price, flash }` → show `price`, strike `listPrice` when `flash`.
  - `chargedSubtotal`, `combo`, `vouchers[]` `{ code, type, pct, amount }` in the order they apply (lần đầu first).
  - `voucherErrors[]` `{ code, message }` (Vietnamese, ready to show).
  - `availableVouchers[]` `{ code, type, pct, capAmount, expiresAt }` → the picker list ("standing" = "Dùng mọi đơn", tick it by default).
  - `freeShipping` → show shipping as ₫0 ("Miễn phí vận chuyển").
  - `gift` `{ eligible, inStock }` → "🎁 Tặng 1 đôi tất" line when eligible.
  - `flashWindowStart` → send back to `placeOrder`.
- Total to show = `chargedSubtotal − combo − Σ vouchers.amount − gacha discount + (freeShipping ? 0 : shipping fee)`.

**`placeOrder({ …today's fields, vouchers?, expectedTotal?, flashWindowStart? })`**
- Send `expectedTotal` (the total shown) and `flashWindowStart` (from the quote). If the server's total differs: `{ ok: false, message, priceChanged: { reason: "flash_ended" | "flash_started" | "other", oldTotal, newTotal } }`, nothing is charged; show the message and the new total, re-quote, let the customer press Đặt hàng again.
- Success adds `shippingFeeBeforeDiscount`, `shippingDiscount`, `giftQty`; `shippingFee` is now what the customer pays.

**`quoteGachaCode({ items, code, deliveryMethod? })`**: a freeship prize on an order that already ships free comes back `ok: false` with "Đơn này đã được miễn phí vận chuyển. Mã freeship được giữ lại cho đơn sau."

**Copy to rename:** "Ưu đãi 5 đơn đầu" → "Khách mua lần đầu" (CheckoutView still has the old label and the first-5 hint for unknown phones; both are dead now).

## Overlap with the gacha game (found 2026-10-21, owner's calls 2026-10-22)

The gacha prizes (20261020000001) already give free shipping and socks, differently from v2:
- **Gacha "freeship" → `shipping_discount`** (decided). PR C stops setting `shipping_fee = 0`; the fee stays what SPX charges the shop and the prize waives it through `shipping_discount`, like v2's free shipping.
  - When the order already has v2 free shipping (≥ 2 `earns_perks` items, standard delivery), a freeship code is **not redeemed**: it stays `issued` for a later order, and the quote says it isn't needed for this one (decided).
- **Gacha socks take stock in PR C** (decided). `socks1` / `socks3` add an `is_gift` line of 1 / 3 units of the gift variant (`is_order_gift`), with the same atomic stock guard, so stock and the BigSeller export see them. `orders.gacha_gift` stays as the packing note. Several pairs per order are fine (owner, 2026-10-22): 1 shirt + `socks1` = 2 pairs, + `socks3` = 4. Out of stock: no special handling (owner expects socks never to run out); the code reuses D2's path (order goes through, `gift_missing`), since the atomic guard must do something when stock is short.
- **Gacha codes in the stacking order**: after the vouchers, as today (`least(gacha, subtotal − discount)`); minimum spend checked on the subtotal before discounts. **aT, 2026-10-22: "trừ 10% mã cố định trước"**: the 10 % "lần đầu" comes off first, every other discount (another % code, the gacha ₫ amount) on what is left.

## Gacha code back on cancel (decided 2026-10-22, separate small RED PR)

Today a cancelled or refused order keeps its `GACHA-` code `redeemed`. Fix: `transition_order_status()` sets the order's gacha code back to `issued` (clears `redeemed_at` / `redeemed_order_id`) when the order goes to `cancelled` or `delivery_failed`. The +2 spin grant from the order stays (owner: fine for now). The order row keeps `gacha_code` / `gacha_discount` as history. A returned code gets a fresh 7 days: `expires_at = now() + 7 days` (owner, 2026-10-22), so a refusal that comes after the original week still leaves the customer a usable code. Independent of pricing v2, so its own PR, before or after PR C.

## Owner's answers (2026-10-18)

1. D1: per product, named `earns_perks` (not "clothing").
2. D2: skip the gift and flag the order.
3. D3b: `PRICE_CHANGED`, with a reason the page can explain (flash ended / started / other).
4. The "Khách mua lần đầu" code: `PDZWELCOME` (aT, 2026-10-27).
