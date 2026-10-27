-- Pricing v2, step 1 (2026-10-21): schema only, no behaviour change.
-- Design: docs/superpowers/specs/2026-10-17-pricing-v2-design.md (PR A).
-- Nothing reads these columns yet and no function changes, so no signature or
-- grant changes either. 'standing' is added here and first used in PR C:
-- Postgres can't use an enum value in the transaction that adds it.

-- D1: one tick per product drives both perks (>= 1 item: gift, >= 2: free shipping).
alter table public.products
  add column earns_perks boolean not null default true;

-- D2: the gift variant (the socks' "Màu Ngẫu Nhiên"), at most one; the gift
-- line on the order; the flag when the gift was out of stock.
alter table public.product_variants
  add column is_order_gift boolean not null default false;
create unique index product_variants_one_order_gift
  on public.product_variants (is_order_gift) where is_order_gift;

alter table public.order_items
  add column is_gift boolean not null default false;
alter table public.orders
  add column gift_missing boolean not null default false;

-- D3: price_snapshot becomes the charged price (flash price included); this
-- keeps the list price. NULL on orders placed before v2, whose price_snapshot
-- already is the list price.
alter table public.order_items
  add column list_price_snapshot numeric(12,0)
    check (list_price_snapshot is null or list_price_snapshot >= 0);

-- D5: free shipping is its own line, so shipping_fee keeps what SPX charges
-- the shop. The total keeps gacha_discount (20261020000001).
alter table public.orders
  add column shipping_discount numeric(12,0) not null default 0,
  add constraint orders_shipping_discount_range
    check (shipping_discount >= 0 and shipping_discount <= shipping_fee);

alter table public.orders drop constraint orders_total_math;
alter table public.orders add constraint orders_total_math
  check (total = subtotal - discount - gacha_discount + shipping_fee - shipping_discount);

-- D4: "Khách mua lần đầu" is a 'standing' voucher (every order, no per-phone
-- limit); listed codes show in the checkout picker; several codes per order,
-- each code at most once.
alter type public.voucher_type add value 'standing';

alter table public.vouchers
  add column is_listed boolean not null default false;

alter table public.voucher_uses drop constraint voucher_uses_order_id_key;
alter table public.voucher_uses
  add constraint voucher_uses_order_voucher_key unique (order_id, voucher_id);
