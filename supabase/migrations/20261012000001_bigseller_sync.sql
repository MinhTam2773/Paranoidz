-- ============================================================
-- BigSeller file sync + inventory page (decided 2026-10-12).
-- Spec: docs/superpowers/specs/2026-10-12-bigseller-inventory-sync-design.md
--
-- BigSeller holds the master stock count. The website imports it (through
-- set_variant_stocks()) and sends back what it sold or adjusted as BigSeller
-- stock-out / stock-in files. These objects remember what was already sent:
--   website stock = max(0, available - unsent_out + unsent_back + unsent_adj)
-- ============================================================

-- ---------- M1: which orders BigSeller knows about ----------
-- exported_at:  the order's units went out in a stock-out file (set once confirmed).
-- restocked_at: an exported order that was then cancelled / refused went back in a stock-in file.
alter table public.orders
  add column bigseller_exported_at  timestamptz,
  add column bigseller_restocked_at timestamptz;

create index orders_bigseller_unsent_idx on public.orders (status)
  where bigseller_exported_at is null;
create index orders_bigseller_back_idx on public.orders (status)
  where bigseller_exported_at is not null and bigseller_restocked_at is null;

-- ---------- M2: SKU snapshot (the stock-out file needs one per line) ----------
alter table public.order_items add column sku_snapshot text;

update public.order_items oi
   set sku_snapshot = v.sku
  from public.product_variants v
 where v.id = oi.variant_id and oi.sku_snapshot is null;

-- ---------- M3: SKUs in one Unicode form ----------
-- "QT03-Xám" typed on some keyboards arrives decomposed (NFD) and would never
-- match BigSeller's text. The admin normalises before saving; this enforces it.
update public.product_variants
   set sku = nullif(normalize(btrim(sku), NFC), '')
 where sku is not null and sku is distinct from normalize(btrim(sku), NFC);

alter table public.product_variants
  add constraint product_variants_sku_nfc check (sku is null or sku = normalize(btrim(sku), NFC));

-- ---------- M4: stock adjustments from the inventory page ----------
create table public.stock_adjustments (
  id           uuid primary key default gen_random_uuid(),
  variant_id   uuid references public.product_variants(id) on delete set null,
  sku_snapshot text not null,
  delta        int  not null check (delta <> 0 and delta between -100000 and 100000),
  reason       text check (reason is null or char_length(reason) <= 100),
  created_by   uuid,
  created_at   timestamptz not null default now(),
  exported_at  timestamptz            -- sent to BigSeller (stock-out if < 0, stock-in if > 0)
);

create index stock_adjustments_unsent_idx on public.stock_adjustments (variant_id)
  where exported_at is null;

-- No policies: only the definer functions below and the service role touch it.
alter table public.stock_adjustments enable row level security;

-- +/- on the inventory page. A delta needs no compare-and-set: `stock + delta >= 0`
-- is the atomic guard, and concurrent orders compose with it. The log row is
-- written in the same transaction, so every change reaches the BigSeller export.
create function public.adjust_variant_stock(p_variant_id uuid, p_delta int, p_reason text default null)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_stock int;
  v_sku   text;
begin
  if auth.role() is distinct from 'service_role' then
    if not coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
      raise exception 'FORBIDDEN';
    end if;
  end if;

  if p_delta is null or p_delta = 0 or abs(p_delta) > 100000 then
    raise exception 'INVALID_DELTA';
  end if;

  update public.product_variants
     set stock = stock + p_delta
   where id = p_variant_id and stock + p_delta >= 0
  returning stock, sku into v_stock, v_sku;

  if not found then
    if exists (select 1 from public.product_variants where id = p_variant_id) then
      raise exception 'STOCK_NEGATIVE';
    end if;
    raise exception 'VARIANT_NOT_FOUND';
  end if;
  if v_sku is null then
    raise exception 'SKU_REQUIRED';  -- rolls the update back: it could never reach BigSeller
  end if;

  insert into public.stock_adjustments (variant_id, sku_snapshot, delta, reason, created_by)
  values (p_variant_id, v_sku, p_delta, nullif(btrim(p_reason), ''), auth.uid());

  return v_stock;
end $$;

revoke execute on function public.adjust_variant_stock(uuid, int, text) from public, anon;
grant  execute on function public.adjust_variant_stock(uuid, int, text) to authenticated, service_role;

-- ---------- What BigSeller doesn't know yet, per variant ----------
-- unsent_out:  units in orders that took stock here and were never exported
--              (pending orders included: place_order() already decremented them).
-- unsent_back: units in exported orders that were then cancelled / refused
--              (restored here, still deducted in BigSeller).
-- unsent_adj:  sum of unexported adjustments.
create function public.bigseller_unsent()
returns table (variant_id uuid, unsent_out int, unsent_back int, unsent_adj int)
language sql stable security definer set search_path = public
as $$
  with o as (
    select oi.variant_id,
           coalesce(sum(oi.qty) filter (
             where o.bigseller_exported_at is null
               and o.status in ('pending', 'confirmed', 'shipped', 'delivered')), 0) as out_qty,
           coalesce(sum(oi.qty) filter (
             where o.bigseller_exported_at is not null and o.bigseller_restocked_at is null
               and o.status in ('cancelled', 'delivery_failed')), 0) as back_qty
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
     where oi.variant_id is not null
     group by oi.variant_id
  ), a as (
    select sa.variant_id, sum(sa.delta) as adj
      from public.stock_adjustments sa
     where sa.exported_at is null and sa.variant_id is not null
     group by sa.variant_id
  )
  select coalesce(o.variant_id, a.variant_id),
         coalesce(o.out_qty, 0)::int,
         coalesce(o.back_qty, 0)::int,
         coalesce(a.adj, 0)::int
    from o full join a on a.variant_id = o.variant_id
   where coalesce(o.out_qty, 0) <> 0 or coalesce(o.back_qty, 0) <> 0 or coalesce(a.adj, 0) <> 0;
$$;

revoke execute on function public.bigseller_unsent() from public, anon, authenticated;
grant  execute on function public.bigseller_unsent() to service_role;

-- ---------- "ĐÃ NHẬP VÀO BIGSELLER": mark one export batch as sent ----------
-- Only the ids that were in the downloaded files; each timestamp is set once.
-- p_out has no status filter: an order cancelled after the download was still
-- in the uploaded stock-out file, so it becomes "back" for the next export.
create function public.mark_bigseller_sent(p_out uuid[], p_back uuid[], p_adjustments uuid[])
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_out  int;
  v_back int;
  v_adj  int;
begin
  if auth.role() is distinct from 'service_role' then
    if not coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
      raise exception 'FORBIDDEN';
    end if;
  end if;

  update public.orders set bigseller_exported_at = now()
   where id = any(coalesce(p_out, '{}')) and bigseller_exported_at is null;
  get diagnostics v_out = row_count;

  update public.orders set bigseller_restocked_at = now()
   where id = any(coalesce(p_back, '{}'))
     and bigseller_exported_at is not null and bigseller_restocked_at is null;
  get diagnostics v_back = row_count;

  update public.stock_adjustments set exported_at = now()
   where id = any(coalesce(p_adjustments, '{}')) and exported_at is null;
  get diagnostics v_adj = row_count;

  return jsonb_build_object('out', v_out, 'back', v_back, 'adjustments', v_adj);
end $$;

revoke execute on function public.mark_bigseller_sent(uuid[], uuid[], uuid[]) from public, anon, authenticated;
grant  execute on function public.mark_bigseller_sent(uuid[], uuid[], uuid[]) to service_role;

-- ---------- M5: rename a colour in the product editor ----------
-- Photos are joined to variants by colour name, so both change together.
-- Order history keeps its color_snapshot; cart lines point at variant ids.
create function public.rename_product_color(p_product_id uuid, p_from text, p_to text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_to text := btrim(p_to);
begin
  if auth.role() is distinct from 'service_role' then
    if not coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
      raise exception 'FORBIDDEN';
    end if;
  end if;

  if v_to is null or char_length(v_to) not between 1 and 40 then
    raise exception 'INVALID_COLOR';
  end if;
  if not exists (select 1 from public.product_variants where product_id = p_product_id and color = p_from) then
    raise exception 'COLOR_NOT_FOUND';
  end if;
  if v_to = p_from then
    return;
  end if;
  -- another colour with the same name (ignoring case) would merge two colours
  if exists (select 1 from public.product_variants
              where product_id = p_product_id and lower(color) = lower(v_to) and color <> p_from) then
    raise exception 'COLOR_EXISTS';
  end if;

  update public.product_variants set color = v_to where product_id = p_product_id and color = p_from;
  update public.product_images   set color = v_to where product_id = p_product_id and color = p_from;
end $$;

revoke execute on function public.rename_product_color(uuid, text, text) from public, anon;
grant  execute on function public.rename_product_color(uuid, text, text) to authenticated, service_role;

-- ---------- place_order(): + sku_snapshot ----------
-- Body from 20261011000002_order_quote.sql, unchanged except the two sku_snapshot
-- lines. CREATE OR REPLACE keeps the existing grants (service_role only).
create or replace function public.place_order(
  p_items           jsonb,      -- [{"variant_id": "...", "qty": 1}, ...]
  p_recipient_name  text,
  p_phone           text,
  p_secondary_phone text default null,
  p_email           text default null,
  p_address         text default null,
  p_ward            text default null,
  p_district        text default null,
  p_city            text default null,
  p_note            text default null,
  p_voucher_code    text default null,
  p_address_id      uuid default null,
  p_user_id         uuid default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  c_max_units      constant int := 20;  -- per order (fake-order abuse guard)
  c_max_pending    constant int := 3;   -- open pending orders per phone
  v_phone          text := public.normalize_vn_phone(p_phone);
  v_secondary      text := null;
  v_customer       public.customers%rowtype;
  v_units          int;
  v_pending        int;
  v_item           record;
  v_variant        record;
  v_product        record;
  v_image          text;
  v_subtotal       numeric(12,0) := 0;
  v_items          jsonb := '[]'::jsonb;
  v_discount       numeric(12,0) := 0;
  v_voucher_id     uuid := null;
  v_counts         jsonb := '{}'::jsonb;  -- product_id -> units, for bundle matching
  v_pricing        jsonb;
  v_applied        jsonb := null;
  v_shipping       numeric(12,0);
  v_order_id       uuid;
  v_order_number   text;
begin
  -- input ------------------------------------------------------
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_ORDER';
  end if;
  if coalesce(trim(p_recipient_name), '') = '' or coalesce(trim(p_address), '') = ''
     or coalesce(trim(p_city), '') = '' or p_phone is null then
    raise exception 'MISSING_DELIVERY_FIELDS';
  end if;
  if v_phone is null then
    raise exception 'INVALID_PHONE';
  end if;
  if coalesce(trim(p_secondary_phone), '') <> '' then
    v_secondary := public.normalize_vn_phone(p_secondary_phone);
    if v_secondary is null then
      raise exception 'INVALID_SECONDARY_PHONE';
    end if;
  end if;
  if p_address_id is not null and not exists (
    select 1 from public.addresses where id = p_address_id and user_id = p_user_id
  ) then
    raise exception 'INVALID_ADDRESS';
  end if;

  select coalesce(sum(qty), 0) into v_units
    from jsonb_to_recordset(p_items) as x(variant_id uuid, qty int);
  if v_units > c_max_units then
    raise exception 'TOO_MANY_ITEMS';
  end if;

  -- shipping: needs only the city + units, so an unknown city fails before any locking.
  v_shipping := public.shipping_fee(p_city, v_units);

  -- customer (phone) gates ---------------------------------------
  -- Row lock serialises concurrent orders from one phone, so the pending
  -- limit, first-5 count and promo check below can't be raced.
  insert into public.customers (phone) values (v_phone) on conflict do nothing;
  select * into v_customer from public.customers where phone = v_phone for update;
  if v_customer.is_blacklisted then
    raise exception 'BLACKLISTED';
  end if;

  select count(*) into v_pending
    from public.orders where phone = v_phone and status = 'pending';
  if v_pending >= c_max_pending then
    raise exception 'TOO_MANY_PENDING';
  end if;

  -- items: atomic stock guard + snapshot build ---------------
  for v_item in
    select * from jsonb_to_recordset(p_items) as x(variant_id uuid, qty int)
  loop
    if v_item.qty is null or v_item.qty <= 0 then
      raise exception 'INVALID_QTY';
    end if;

    update public.product_variants
       set stock = stock - v_item.qty
     where id = v_item.variant_id
       and stock >= v_item.qty
    returning * into v_variant;

    if not found then
      raise exception 'OUT_OF_STOCK:%', v_item.variant_id;
      -- entire transaction rolls back; earlier decrements are undone
    end if;

    select * into v_product from public.products
     where id = v_variant.product_id and is_active = true;
    if not found then
      raise exception 'PRODUCT_INACTIVE:%', v_variant.product_id;
    end if;

    -- exact colourway first, then general (color IS NULL) images.
    -- NULLS LAST is required: `desc` alone puts the NULL comparison first.
    select storage_path into v_image
      from public.product_images
     where product_id = v_product.id
       and (color = v_variant.color or color is null)
     order by (color = v_variant.color) desc nulls last, is_primary desc, sort_order
     limit 1;

    v_subtotal := v_subtotal + (v_variant.price * v_item.qty);
    v_counts := jsonb_set(v_counts, array[v_product.id::text],
                          to_jsonb(coalesce((v_counts ->> v_product.id::text)::int, 0) + v_item.qty));
    v_items := v_items || jsonb_build_object(
      'product_id',     v_product.id,
      'variant_id',     v_variant.id,
      'name_snapshot',  v_product.name,
      'color_snapshot', v_variant.color,
      'size_snapshot',  v_variant.size,
      'price_snapshot', v_variant.price,
      'image_snapshot', v_image,
      'sku_snapshot',   v_variant.sku,
      'qty',            v_item.qty
    );
  end loop;

  -- discount: first-5 vs promo vs bundles, best wins (order_discount, shared with quote_order)
  v_pricing    := public.order_discount(v_phone, v_subtotal, v_counts, p_voucher_code);
  v_discount   := (v_pricing ->> 'discount')::numeric;
  v_voucher_id := (v_pricing ->> 'voucher_id')::uuid;
  v_applied    := nullif(v_pricing -> 'bundles', 'null'::jsonb);

  -- order + items + history + voucher use --------------------
  v_order_number := 'PZ-' || to_char(now(), 'YYYY') || '-' ||
                    lpad(nextval('public.order_number_seq')::text, 4, '0');

  insert into public.orders (
    order_number, user_id, address_id,
    recipient_name, phone, secondary_phone, email,
    address, ward, district, city, note,
    status, subtotal, discount, shipping_fee, total, applied_bundles
  ) values (
    v_order_number, p_user_id, p_address_id,
    trim(p_recipient_name), v_phone, v_secondary, nullif(trim(p_email), ''),
    trim(p_address), nullif(trim(p_ward), ''), nullif(trim(p_district), ''), trim(p_city),
    nullif(trim(p_note), ''),
    'pending', v_subtotal, v_discount, v_shipping, v_subtotal - v_discount + v_shipping, v_applied
  ) returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, variant_id, name_snapshot,
    color_snapshot, size_snapshot, price_snapshot, image_snapshot, sku_snapshot, qty
  )
  select v_order_id,
         (i ->> 'product_id')::uuid,
         (i ->> 'variant_id')::uuid,
         i ->> 'name_snapshot',
         i ->> 'color_snapshot',
         i ->> 'size_snapshot',
         (i ->> 'price_snapshot')::numeric,
         i ->> 'image_snapshot',
         i ->> 'sku_snapshot',
         (i ->> 'qty')::int
    from jsonb_array_elements(v_items) as i;

  insert into public.order_status_history (order_id, status)
  values (v_order_id, 'pending');

  if v_voucher_id is not null then
    -- atomic redemption guard: same shape as the stock guard above. Checking
    -- used_count < max_uses at SELECT time and incrementing later would let two
    -- concurrent orders both redeem the last use.
    update public.vouchers
       set used_count = used_count + 1
     where id = v_voucher_id
       and (max_uses is null or used_count < max_uses);
    if not found then
      raise exception 'VOUCHER_EXHAUSTED';
    end if;

    insert into public.voucher_uses (voucher_id, phone, order_id, voucher_type)
    select v_voucher_id, v_phone, v_order_id, type
      from public.vouchers where id = v_voucher_id;
  end if;

  return jsonb_build_object(
    'order_id',     v_order_id,
    'order_number', v_order_number,
    'subtotal',     v_subtotal,
    'discount',     v_discount,
    'shipping_fee', v_shipping,
    'total',        v_subtotal - v_discount + v_shipping
  );
end $$;
