-- Flash sale option B (2026-10-17): the window's extra discount applies ONLY to
-- 4 deterministically picked products, not to every product in the cart.
--   * public.flash_sale_picks(p_at) -> uuid[]: the 4 picks for the window active
--     at p_at (default now()); '{}' when no window is active. Deterministic per
--     window so homepage / quote / place_order all agree.
--   * order_discount() gains p_items so it can price exactly the picked lines.
--   * place_order() / quote_order() pass their items through.
-- The storefront reads the picks via the same function for its flash section.

-- Flash sale option B (2026-10-17): the discount applies ONLY to the window's
-- picked products, not to every product. Picks are deterministic per window
-- (md5 of window start + product id), so the homepage, cart, checkout quote and
-- place_order() all agree without trusting the browser.

create or replace function public.flash_sale_picks(p_at timestamptz default now())
returns uuid[]
language plpgsql security definer set search_path = public
as $$
declare
  v_vn     timestamp := (p_at at time zone 'Asia/Ho_Chi_Minh');
  v_day    date := v_vn::date;
  r        record;
  v_start  timestamptz := null;
  v_wstart timestamptz;
  v_wend   timestamptz;
  d        int;
begin
  for r in
    select w.discount_percent, w.start_hour, w.duration_minutes
      from public.flash_sale_windows w
     where w.enabled
       and w.discount_percent > 0
       and w.duration_minutes > 0
     order by w.start_hour
  loop
    -- yesterday's and today's occurrence: windows may cross midnight
    for d in -1 .. 0 loop
      v_wstart := ((v_day + d) + make_time(r.start_hour, 0, 0)) at time zone 'Asia/Ho_Chi_Minh';
      v_wend := v_wstart + make_interval(mins => r.duration_minutes);
      if p_at >= v_wstart and p_at < v_wend then
        v_start := v_wstart;
        exit;
      end if;
    end loop;
    exit when v_start is not null;
  end loop;

  if v_start is null then
    return '{}';
  end if;

  -- Candidates mirror the storefront's on-sale definition: the cheapest
  -- in-stock variant has original_price > price.
  return coalesce((
    select array_agg(s.id)
      from (
        select p.id
          from public.products p
         cross join lateral (
           select v.price, v.original_price
             from public.product_variants v
            where v.product_id = p.id
              and v.stock > 0
            order by v.price, v.id
            limit 1
         ) c
         where p.is_active
           and c.original_price is not null
           and c.original_price > c.price
         order by md5(v_start::text || p.id::text)
         limit 4
      ) s
  ), '{}');
end $$;

grant execute on function public.flash_sale_picks(timestamptz) to anon, authenticated, service_role;

-- order_discount() gains p_items, which changes its signature: drop the old
-- 4-arg version first. (CREATE OR REPLACE with a new parameter would create a
-- second overload that keeps the default PUBLIC execute privilege.)
drop function if exists public.order_discount(text, numeric, jsonb, text);

create function public.order_discount(p_phone text, p_subtotal numeric, p_counts jsonb, p_voucher_code text,
  p_items jsonb default null) -- [{"variant_id": "...", "qty": 1}]: lets flash sale price only picked lines
returns jsonb
language plpgsql set search_path = public
as $$
declare
  v_prior_orders    int := 0;
  v_auto_voucher    public.vouchers%rowtype;
  v_promo_voucher   public.vouchers%rowtype;
  v_auto_discount   numeric(12,0) := 0;
  v_promo_discount  numeric(12,0) := 0;
  v_discount        numeric(12,0) := 0;
  v_voucher_id      uuid := null;
  v_source          text := null;
  v_bundles         jsonb;
  v_bundle_discount numeric(12,0) := 0;
  v_applied         jsonb := null;
  v_flash_pct       int := 0;
  v_flash_discount  numeric(12,0) := 0;
  v_flash_base      numeric(12,0) := 0;
begin
  -- voucher: auto first-5 vs promo code, better wins ---------
  if p_phone is not null then
    select count(*) into v_prior_orders
      from public.orders
     where phone = p_phone
       and status not in ('cancelled', 'delivery_failed');
  end if;

  if v_prior_orders < 5 then
    select * into v_auto_voucher from public.vouchers
     where type = 'auto_first5' and is_active = true
     order by created_at
     limit 1;
    if found then
      v_auto_discount := floor(p_subtotal * v_auto_voucher.discount_pct / 100.0);
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

    if p_phone is not null and exists (
      select 1 from public.voucher_uses
       where voucher_id = v_promo_voucher.id
         and phone = p_phone
         and released_at is null
    ) then
      raise exception 'VOUCHER_ALREADY_USED';
    end if;

    v_promo_discount := floor(p_subtotal * v_promo_voucher.discount_pct / 100.0);
    if v_promo_voucher.cap_amount is not null then
      v_promo_discount := least(v_promo_discount, v_promo_voucher.cap_amount);
    end if;
  end if;

  if v_promo_discount > v_auto_discount then
    v_discount := v_promo_discount;
    v_voucher_id := v_promo_voucher.id;
    v_source := 'promo';
  elsif v_auto_discount > 0 then
    v_discount := v_auto_discount;
    v_voucher_id := v_auto_voucher.id;
    v_source := 'auto_first5';
  end if;

  -- bundles vs voucher, better wins (ARCHITECTURE.md §5) -----
  v_bundles := public.best_bundles(p_counts);
  v_bundle_discount := least((v_bundles ->> 'amount')::numeric, p_subtotal);
  if v_bundle_discount > 0 and v_bundle_discount >= v_discount then
    v_discount := v_bundle_discount;
    v_voucher_id := null;
    v_source := 'bundle';
    v_applied := v_bundles -> 'bundles';
  end if;

  -- flash sale (2026-10-17, option B): extra % off ONLY the window's picked
  -- products (public.flash_sale_picks()), stacks on top. p_items lets us price
  -- exactly the picked lines; callers without it keep whole-subtotal behavior.
  v_flash_pct := public.active_flash_sale_discount();
  if v_flash_pct > 0 then
    if p_items is not null then
      select coalesce(sum(v.price * x.qty), 0) into v_flash_base
        from jsonb_to_recordset(p_items) as x(variant_id uuid, qty int)
        join public.product_variants v on v.id = x.variant_id
        join public.products p on p.id = v.product_id and p.is_active
       where x.qty > 0
         and v.product_id = any (public.flash_sale_picks());
    else
      v_flash_base := p_subtotal;
    end if;
    v_flash_discount := floor(v_flash_base * v_flash_pct / 100.0);
    v_discount := v_discount + v_flash_discount;
  end if;

  return jsonb_build_object(
    'discount',       v_discount,
    'voucher_id',     v_voucher_id,
    'source',         v_source,
    'pct',            case v_source when 'promo' then v_promo_voucher.discount_pct
                                    when 'auto_first5' then v_auto_voucher.discount_pct end,
    'code',           case when v_source = 'promo' then v_promo_voucher.code end,
    'flash_pct',      nullif(v_flash_pct, 0),
    'flash_discount', nullif(v_flash_discount, 0),
    'bundles',        v_applied
  );
end $$;

revoke execute on function public.order_discount(text, numeric, jsonb, text, jsonb) from public, anon, authenticated;

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
  v_pricing    := public.order_discount(v_phone, v_subtotal, v_counts, p_voucher_code, p_items);
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

create or replace function public.quote_order(p_items jsonb, p_phone text default null, p_voucher_code text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_phone    text := public.normalize_vn_phone(p_phone);
  v_units    int;
  v_item     record;
  v_subtotal numeric(12,0) := 0;
  v_counts   jsonb := '{}'::jsonb;
  v_pricing  jsonb;
  v_error    text := null;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_ORDER';
  end if;
  select coalesce(sum(qty), 0) into v_units
    from jsonb_to_recordset(p_items) as x(variant_id uuid, qty int);
  if v_units > 20 then
    raise exception 'TOO_MANY_ITEMS';
  end if;

  -- The prices and per-product counts place_order() would use (active products only).
  for v_item in
    select v.product_id, v.price, x.qty
      from jsonb_to_recordset(p_items) as x(variant_id uuid, qty int)
      join public.product_variants v on v.id = x.variant_id
      join public.products p on p.id = v.product_id and p.is_active
     where x.qty > 0
  loop
    v_subtotal := v_subtotal + v_item.price * v_item.qty;
    v_counts := jsonb_set(v_counts, array[v_item.product_id::text],
                          to_jsonb(coalesce((v_counts ->> v_item.product_id::text)::int, 0) + v_item.qty));
  end loop;

  begin
    v_pricing := public.order_discount(v_phone, v_subtotal, v_counts, p_voucher_code, p_items);
  exception when raise_exception then
    if sqlerrm not in ('INVALID_VOUCHER', 'VOUCHER_ALREADY_USED') then
      raise;
    end if;
    v_error := sqlerrm;
    v_pricing := public.order_discount(v_phone, v_subtotal, v_counts, null, p_items);
  end;

  return (v_pricing - 'voucher_id') || jsonb_build_object(
    'subtotal',      v_subtotal,
    'voucher_error', v_error,
    'phone_known',   v_phone is not null
  );
end $$;

revoke execute on function public.quote_order(jsonb, text, text) from public, anon, authenticated;
grant execute on function public.quote_order(jsonb, text, text) to service_role;
