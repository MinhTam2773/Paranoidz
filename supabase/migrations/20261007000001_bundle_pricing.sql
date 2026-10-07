-- ============================================================
-- Bundle (combo) pricing in place_order() — ARCHITECTURE.md §5, decided 2026-10-07.
-- * A bundle's flat ₫ discount applies once per complete set (any variant of each product).
-- * Each unit counts toward one bundle only; overlapping bundles resolve to the
--   combination of sets that saves the most (best_bundles()).
-- * No stacking: the order gets the better of the bundle total and the voucher
--   (first-5 / promo). Tie → bundle. A winning bundle writes no voucher_uses row.
-- * orders.applied_bundles snapshots what was applied (bundles can change later).
-- ============================================================

alter table public.orders add column applied_bundles jsonb;
comment on column public.orders.applied_bundles is
  '[{bundle_id, name, discount_amount, sets}] when a bundle discount priced the order, else NULL';

-- Exhaustive search over candidate bundles (all products present), largest discount
-- first. Branches only on feasible set counts, and orders are capped at 20 units
-- (place_order c_max_units), so the tree stays small.
-- p_bundles: [{id, name, amount, products: [product_id…]}]; p_counts: {product_id: units}.
-- Returns {"amount": n, "sets": {bundle_id: sets}}.
create function public.best_bundles_search(p_bundles jsonb, p_i int, p_counts jsonb)
returns jsonb
language plpgsql immutable set search_path = public
as $$
declare
  v_bundle jsonb := p_bundles -> p_i;
  v_max    int;
  v_counts jsonb;
  v_pid    text;
  v_sub    jsonb;
  v_amount numeric;
  v_best   jsonb;
begin
  if p_i >= jsonb_array_length(p_bundles) then
    return '{"amount": 0, "sets": {}}'::jsonb;
  end if;

  select coalesce(min(coalesce((p_counts ->> pid)::int, 0)), 0) into v_max
    from jsonb_array_elements_text(v_bundle -> 'products') as pid;

  v_best := public.best_bundles_search(p_bundles, p_i + 1, p_counts);  -- 0 sets of this one
  for k in 1 .. v_max loop
    v_counts := p_counts;
    for v_pid in select jsonb_array_elements_text(v_bundle -> 'products') loop
      v_counts := jsonb_set(v_counts, array[v_pid], to_jsonb((p_counts ->> v_pid)::int - k));
    end loop;
    v_sub := public.best_bundles_search(p_bundles, p_i + 1, v_counts);
    v_amount := k * (v_bundle ->> 'amount')::numeric + (v_sub ->> 'amount')::numeric;
    if v_amount > (v_best ->> 'amount')::numeric then
      v_best := jsonb_build_object('amount', v_amount,
                                   'sets', (v_sub -> 'sets') || jsonb_build_object(v_bundle ->> 'id', k));
    end if;
  end loop;
  return v_best;
end $$;

-- Best bundle discount for a cart. p_counts: {product_id: units}.
-- Returns {"amount": n, "bundles": [{bundle_id, name, discount_amount, sets}]} (amount 0 / [] if none).
-- Not capped at the subtotal: place_order() does that.
create function public.best_bundles(p_counts jsonb)
returns jsonb
language plpgsql stable set search_path = public
as $$
declare
  v_candidates jsonb;
  v_result     jsonb;
begin
  select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'amount', c.discount_amount, 'products', c.products)
                   order by c.discount_amount desc, c.id)
    into v_candidates
    from (
      select b.id, b.name, b.discount_amount, jsonb_agg(bi.product_id) as products
        from public.bundles b
        join public.bundle_items bi on bi.bundle_id = b.id
       where b.is_active and b.discount_amount > 0
       group by b.id
      having bool_and(coalesce((p_counts ->> bi.product_id::text)::int, 0) >= 1)
    ) c;

  if v_candidates is null then
    return '{"amount": 0, "bundles": []}'::jsonb;
  end if;

  v_result := public.best_bundles_search(v_candidates, 0, p_counts);
  return jsonb_build_object(
    'amount', (v_result ->> 'amount')::numeric,
    'bundles', coalesce((
      select jsonb_agg(jsonb_build_object('bundle_id', c ->> 'id', 'name', c ->> 'name',
                                          'discount_amount', (c ->> 'amount')::numeric,
                                          'sets', (v_result -> 'sets' ->> (c ->> 'id'))::int)
                       order by (c ->> 'amount')::numeric desc)
        from jsonb_array_elements(v_candidates) c
       where v_result -> 'sets' ? (c ->> 'id')
    ), '[]'::jsonb)
  );
end $$;

-- Server-only for now, like place_order (a storefront preview can open this up later).
revoke execute on function public.best_bundles_search(jsonb, int, jsonb) from public, anon, authenticated;
revoke execute on function public.best_bundles(jsonb) from public, anon, authenticated;
grant execute on function public.best_bundles(jsonb) to service_role;

-- place_order(): body from 20260926000001_guest_checkout.sql + the bundle step.
-- CREATE OR REPLACE keeps the existing grants (service_role only).
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
  v_prior_orders   int;
  v_auto_voucher   public.vouchers%rowtype;
  v_promo_voucher  public.vouchers%rowtype;
  v_auto_discount  numeric(12,0) := 0;
  v_promo_discount numeric(12,0) := 0;
  v_discount       numeric(12,0) := 0;
  v_voucher_id     uuid := null;
  v_counts         jsonb := '{}'::jsonb;  -- product_id -> units, for bundle matching
  v_bundles        jsonb;
  v_bundle_discount numeric(12,0) := 0;
  v_applied        jsonb := null;
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
      'qty',            v_item.qty
    );
  end loop;

  -- voucher: auto first-5 vs promo code, better wins ---------
  select count(*) into v_prior_orders
    from public.orders
   where phone = v_phone
     and status not in ('cancelled', 'delivery_failed');

  if v_prior_orders < 5 then
    select * into v_auto_voucher from public.vouchers
     where type = 'auto_first5' and is_active = true
     order by created_at
     limit 1;
    if found then
      v_auto_discount := floor(v_subtotal * v_auto_voucher.discount_pct / 100.0);
      if v_auto_voucher.cap_amount is not null then
        v_auto_discount := least(v_auto_discount, v_auto_voucher.cap_amount);
      end if;
    end if;
  end if;

  if p_voucher_code is not null and length(trim(p_voucher_code)) > 0 then
    select * into v_promo_voucher from public.vouchers
     where code = upper(trim(p_voucher_code))
       and type = 'promo'
       and is_active = true
       and (expires_at is null or expires_at > now())
       and (max_uses is null or used_count < max_uses);
    if not found then
      raise exception 'INVALID_VOUCHER';
    end if;

    -- one redemption per phone; the partial unique index on voucher_uses is
    -- the real guard, this is only here to return a legible error.
    if exists (
      select 1 from public.voucher_uses
       where voucher_id = v_promo_voucher.id
         and phone = v_phone
         and released_at is null
    ) then
      raise exception 'VOUCHER_ALREADY_USED';
    end if;

    v_promo_discount := floor(v_subtotal * v_promo_voucher.discount_pct / 100.0);
    if v_promo_voucher.cap_amount is not null then
      v_promo_discount := least(v_promo_discount, v_promo_voucher.cap_amount);
    end if;
  end if;

  if v_promo_discount > v_auto_discount then
    v_discount := v_promo_discount;
    v_voucher_id := v_promo_voucher.id;
  elsif v_auto_discount > 0 then
    v_discount := v_auto_discount;
    v_voucher_id := v_auto_voucher.id;
  end if;

  -- bundles vs voucher, better wins (ARCHITECTURE.md §5) -----
  -- A tie goes to the bundle so the customer keeps their promo use.
  v_bundles := public.best_bundles(v_counts);
  v_bundle_discount := least((v_bundles ->> 'amount')::numeric, v_subtotal);
  if v_bundle_discount > 0 and v_bundle_discount >= v_discount then
    v_discount := v_bundle_discount;
    v_voucher_id := null;
    v_applied := v_bundles -> 'bundles';
  end if;

  -- order + items + history + voucher use --------------------
  v_order_number := 'PZ-' || to_char(now(), 'YYYY') || '-' ||
                    lpad(nextval('public.order_number_seq')::text, 4, '0');

  insert into public.orders (
    order_number, user_id, address_id,
    recipient_name, phone, secondary_phone, email,
    address, ward, district, city, note,
    status, subtotal, discount, total, applied_bundles
  ) values (
    v_order_number, p_user_id, p_address_id,
    trim(p_recipient_name), v_phone, v_secondary, nullif(trim(p_email), ''),
    trim(p_address), nullif(trim(p_ward), ''), nullif(trim(p_district), ''), trim(p_city),
    nullif(trim(p_note), ''),
    'pending', v_subtotal, v_discount, v_subtotal - v_discount, v_applied
  ) returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, variant_id, name_snapshot,
    color_snapshot, size_snapshot, price_snapshot, image_snapshot, qty
  )
  select v_order_id,
         (i ->> 'product_id')::uuid,
         (i ->> 'variant_id')::uuid,
         i ->> 'name_snapshot',
         i ->> 'color_snapshot',
         i ->> 'size_snapshot',
         (i ->> 'price_snapshot')::numeric,
         i ->> 'image_snapshot',
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
    'total',        v_subtotal - v_discount
  );
end $$;

