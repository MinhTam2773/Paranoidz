-- Pricing v2, step 3 (2026-10-27): the new rules (ARCHITECTURE.md §5 "Pricing v2",
-- docs/superpowers/specs/2026-10-17-pricing-v2-design.md, PR C). Columns came in
-- 20261026000001; this switches the functions over.
--   1. Item price = flash price inside a window for the window's picks, else list
--      price. Rounded like the storefront's flashPrice() (nearest ₫1.000), so the
--      order charges exactly the price shown. The flash sale leaves `discount`.
--   2. Combo (best_bundles), on the charged subtotal.
--   3. Vouchers the customer picked, one after another on what is left:
--      'standing' ones first ("Khách mua lần đầu" PDZWELCOME, every order), then
--      'promo' ones (once per phone). No limit on how many (aT, 2026-10-27).
--   4. Free shipping: standard delivery + ≥ 2 `earns_perks` units → the whole fee
--      goes into orders.shipping_discount (shipping_fee keeps what SPX charges).
--   5. Gift: ≥ 1 `earns_perks` unit → 1 unit of the is_order_gift variant, taken
--      from stock like any line; gacha socks prizes add 1 / 3 more. Out of stock
--      (or no gift variant set) → the order goes through, gift_missing = true.
--   6. Gacha: freeship prize → shipping_discount; not redeemed when the order
--      already ships free. Its ₫ prizes still come after the vouchers.
--   7. p_expected_total: the total the page showed; a different total raises
--      PRICE_CHANGED (the whole transaction rolls back, stock included).
-- AUTO-FIRST5 retires (row kept for old orders); PDZWELCOME replaces it.
-- Signature changes: drop the old, create the new, revoke from public / anon /
-- authenticated, grant to service_role (LESSONS § Workflow, 2026-10-17).

-- the active flash window ------------------------------------------------
-- Its start identifies one occurrence (a window has no id per day); the page
-- sends it back so a PRICE_CHANGED can say "the flash sale just ended / started".
create function public.flash_window(p_at timestamptz default now(),
  out window_start timestamptz, out discount_percent int)
language plpgsql stable set search_path = public
as $$
declare
  v_day date := (p_at at time zone 'Asia/Ho_Chi_Minh')::date;
  r     record;
  d     int;
  v_s   timestamptz;
begin
  for r in
    select w.discount_percent, w.start_hour, w.duration_minutes
      from public.flash_sale_windows w
     where w.enabled and w.discount_percent > 0 and w.duration_minutes > 0
     order by w.start_hour
  loop
    -- yesterday's and today's occurrence: windows may cross midnight
    for d in -1 .. 0 loop
      v_s := ((v_day + d) + make_time(r.start_hour, 0, 0)) at time zone 'Asia/Ho_Chi_Minh';
      if p_at >= v_s and p_at < v_s + make_interval(mins => r.duration_minutes) then
        window_start := v_s;
        discount_percent := r.discount_percent;
        return;
      end if;
    end loop;
  end loop;
end $$;

revoke execute on function public.flash_window(timestamptz) from public, anon, authenticated;
grant execute on function public.flash_window(timestamptz) to service_role;

-- The storefront's flashPrice(): round(price × (1 − pct/100) / 1000) × 1000, never below 0.
create function public.flash_unit_price(p_price numeric, p_pct int)
returns numeric
language sql immutable
as $$ select greatest(0, round(p_price * (100 - p_pct) / 100.0 / 1000) * 1000) $$;

revoke execute on function public.flash_unit_price(numeric, int) from public, anon, authenticated;
grant execute on function public.flash_unit_price(numeric, int) to service_role;

-- order_discount v2 --------------------------------------------------------
-- p_subtotal is the CHARGED subtotal (flash prices included). Strict (place_order):
-- a code that can't apply raises INVALID_VOUCHER:<code> / VOUCHER_ALREADY_USED:<code>.
-- Not strict (quote_order): it is skipped and listed in voucher_errors.
drop function if exists public.order_discount(text, numeric, jsonb, text, jsonb);

create function public.order_discount(p_phone text, p_subtotal numeric, p_counts jsonb,
  p_voucher_codes text[] default null, p_strict boolean default true)
returns jsonb
language plpgsql set search_path = public
as $$
declare
  v_bundles   jsonb := public.best_bundles(p_counts);
  v_combo     numeric(12,0) := least((v_bundles ->> 'amount')::numeric, p_subtotal);
  v_left      numeric(12,0);
  v_code      text;
  v_voucher   public.vouchers%rowtype;
  v_found     public.vouchers[] := '{}';
  v_amount    numeric(12,0);
  v_applied   jsonb := '[]'::jsonb;
  v_errors    jsonb := '[]'::jsonb;
  v_error     text;
begin
  v_left := p_subtotal - v_combo;

  -- each distinct code once, in the order given
  foreach v_code in array coalesce(p_voucher_codes, '{}') loop
    v_code := upper(trim(v_code));
    continue when v_code = '' or v_code = any (select (f).code from unnest(v_found) f);
    v_error := null;
    select * into v_voucher from public.vouchers
     where code = v_code
       and type in ('standing', 'promo')
       and is_active
       and (expires_at is null or expires_at > now())
       and (max_uses is null or used_count < max_uses);
    if not found then
      v_error := 'INVALID_VOUCHER';
    elsif v_voucher.type = 'promo' and p_phone is not null and exists (
      select 1 from public.voucher_uses
       where voucher_id = v_voucher.id and phone = p_phone and released_at is null
    ) then
      v_error := 'VOUCHER_ALREADY_USED';
    end if;

    if v_error is not null then
      if p_strict then
        raise exception '%:%', v_error, v_code;
      end if;
      v_errors := v_errors || jsonb_build_object('code', v_code, 'error', v_error);
    else
      v_found := v_found || v_voucher;
    end if;
  end loop;

  -- standing first, then promo; each on what the previous ones left
  for v_voucher in
    select * from unnest(v_found) f order by (f.type = 'promo'), array_position(v_found, f)
  loop
    v_amount := floor(v_left * v_voucher.discount_pct / 100.0);
    if v_voucher.cap_amount is not null then
      v_amount := least(v_amount, v_voucher.cap_amount);
    end if;
    v_left := v_left - v_amount;
    v_applied := v_applied || jsonb_build_object(
      'id', v_voucher.id, 'code', v_voucher.code, 'type', v_voucher.type,
      'pct', v_voucher.discount_pct, 'amount', v_amount);
  end loop;

  return jsonb_build_object(
    'combo',          v_combo,
    'bundles',        case when v_combo > 0 then v_bundles -> 'bundles' end,
    'vouchers',       v_applied,
    'voucher_errors', v_errors,
    'discount',       p_subtotal - v_left
  );
end $$;

revoke execute on function public.order_discount(text, numeric, jsonb, text[], boolean) from public, anon, authenticated;
grant execute on function public.order_discount(text, numeric, jsonb, text[], boolean) to service_role;

-- quote_order v2 (checkout preview, no writes) -------------------------------
drop function if exists public.quote_order(jsonb, text, text);

create function public.quote_order(p_items jsonb, p_phone text default null,
  p_voucher_codes text[] default null, p_delivery_method text default 'standard')
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_phone      text := public.normalize_vn_phone(p_phone);
  v_window     record := public.flash_window();
  v_picks      uuid[] := public.flash_sale_picks();
  v_units      int;
  v_item       record;
  v_price      numeric(12,0);
  v_list_total numeric(12,0) := 0;
  v_subtotal   numeric(12,0) := 0;
  v_perks      int := 0;
  v_counts     jsonb := '{}'::jsonb;
  v_lines      jsonb := '[]'::jsonb;
  v_pricing    jsonb;
  v_available  jsonb;
  v_gift_stock int;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_ORDER';
  end if;
  select coalesce(sum(qty), 0) into v_units
    from jsonb_to_recordset(p_items) as x(variant_id uuid, qty int);
  if v_units > 20 then
    raise exception 'TOO_MANY_ITEMS';
  end if;

  -- the prices place_order() would charge (active products only)
  for v_item in
    select v.id as variant_id, v.product_id, v.price, p.earns_perks, x.qty
      from jsonb_to_recordset(p_items) as x(variant_id uuid, qty int)
      join public.product_variants v on v.id = x.variant_id
      join public.products p on p.id = v.product_id and p.is_active
     where x.qty > 0
  loop
    v_price := case when v_window.discount_percent is not null and v_item.product_id = any (v_picks)
                    then public.flash_unit_price(v_item.price, v_window.discount_percent) else v_item.price end;
    v_list_total := v_list_total + v_item.price * v_item.qty;
    v_subtotal := v_subtotal + v_price * v_item.qty;
    if v_item.earns_perks then v_perks := v_perks + v_item.qty; end if;
    v_counts := jsonb_set(v_counts, array[v_item.product_id::text],
                          to_jsonb(coalesce((v_counts ->> v_item.product_id::text)::int, 0) + v_item.qty));
    v_lines := v_lines || jsonb_build_object('variant_id', v_item.variant_id, 'qty', v_item.qty,
      'list_price', v_item.price, 'price', v_price, 'flash', v_price <> v_item.price);
  end loop;

  v_pricing := public.order_discount(v_phone, v_subtotal, v_counts, p_voucher_codes, false);

  -- the checkout picker: listed codes this phone can still use
  select coalesce(jsonb_agg(jsonb_build_object('code', vc.code, 'type', vc.type, 'pct', vc.discount_pct,
           'cap_amount', vc.cap_amount, 'expires_at', vc.expires_at)
           order by (vc.type = 'promo'), vc.discount_pct desc, vc.code), '[]'::jsonb)
    into v_available
    from public.vouchers vc
   where vc.is_listed and vc.is_active and vc.type in ('standing', 'promo')
     and (vc.expires_at is null or vc.expires_at > now())
     and (vc.max_uses is null or vc.used_count < vc.max_uses)
     and not (vc.type = 'promo' and v_phone is not null and exists (
       select 1 from public.voucher_uses vu
        where vu.voucher_id = vc.id and vu.phone = v_phone and vu.released_at is null));

  select stock into v_gift_stock from public.product_variants where is_order_gift;

  return v_pricing || jsonb_build_object(
    'lines',              v_lines,
    'list_subtotal',      v_list_total,
    'subtotal',           v_subtotal,
    'flash_pct',          v_window.discount_percent,
    'flash_window_start', v_window.window_start,
    'perks_units',        v_perks,
    'free_shipping',      coalesce(p_delivery_method, 'standard') = 'standard' and v_perks >= 2,
    'gift',               jsonb_build_object('eligible', v_perks >= 1, 'in_stock', coalesce(v_gift_stock, 0) >= 1),
    'available_vouchers', v_available,
    'phone_known',        v_phone is not null
  );
end $$;

revoke execute on function public.quote_order(jsonb, text, text[], text) from public, anon, authenticated;
grant execute on function public.quote_order(jsonb, text, text[], text) to service_role;

-- gacha_quote_code: + perks_units, so checkout can say a freeship prize isn't needed
-- (same signature: CREATE OR REPLACE keeps the grants).
create or replace function public.gacha_quote_code(p_code text, p_items jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_gc             public.gacha_codes%rowtype;
  v_item           record;
  v_subtotal       numeric(12,0) := 0;
  v_cheapest_shirt numeric(12,0) := null;
  v_discount       numeric(12,0) := 0;
  v_freeship       boolean := false;
  v_gift           text := null;
  v_perks          int := 0;
  v_window         record := public.flash_window();
  v_picks          uuid[] := public.flash_sale_picks();
  v_price          numeric(12,0);
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('ok', false, 'error', 'GACHA_INVALID');
  end if;

  select * into v_gc from public.gacha_codes
   where code = upper(trim(coalesce(p_code, '')));
  if not found then
    return jsonb_build_object('ok', false, 'error', 'GACHA_INVALID');
  end if;
  if v_gc.status = 'redeemed' then
    return jsonb_build_object('ok', false, 'error', 'GACHA_USED');
  end if;
  if v_gc.status <> 'issued' or v_gc.expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'GACHA_EXPIRED');
  end if;

  for v_item in
    select v.price, v.product_id, p.name as product_name, p.earns_perks, x.qty
      from jsonb_to_recordset(p_items) as x(variant_id uuid, qty int)
      join public.product_variants v on v.id = x.variant_id
      join public.products p on p.id = v.product_id and p.is_active
     where x.qty > 0
  loop
    v_price := case when v_window.discount_percent is not null and v_item.product_id = any (v_picks)
                    then public.flash_unit_price(v_item.price, v_window.discount_percent) else v_item.price end;
    v_subtotal := v_subtotal + v_price * v_item.qty;
    if v_item.earns_perks then v_perks := v_perks + v_item.qty; end if;
    if v_item.product_name like 'Áo%' then
      v_cheapest_shirt := least(coalesce(v_cheapest_shirt, v_price), v_price);
    end if;
  end loop;

  case v_gc.prize_type
    when 'voucher10' then
      if v_subtotal < 150000 then
        return jsonb_build_object('ok', false, 'error', 'GACHA_MIN_NOT_MET');
      end if;
      v_discount := 10000;
    when 'voucher20' then
      if v_subtotal < 249000 then
        return jsonb_build_object('ok', false, 'error', 'GACHA_MIN_NOT_MET');
      end if;
      v_discount := 20000;
    when 'freeship' then
      v_freeship := true;
    when 'socks1' then
      v_gift := 'Tặng 1 đôi vớ kèm đơn (quà quay thưởng)';
    when 'socks3' then
      v_gift := 'Tặng bộ 3 đôi vớ kèm đơn (quà quay thưởng)';
    when 'shirt' then
      if v_cheapest_shirt is null then
        return jsonb_build_object('ok', false, 'error', 'GACHA_NO_SHIRT');
      end if;
      v_discount := v_cheapest_shirt;
    else
      return jsonb_build_object('ok', false, 'error', 'GACHA_INVALID');
  end case;

  return jsonb_build_object(
    'ok', true,
    'prize_type', v_gc.prize_type,
    'tier', v_gc.tier,
    'discount', least(v_discount, v_subtotal),
    'freeship', v_freeship,
    'gift', v_gift,
    'perks_units', v_perks
  );
end $$;

-- place_order v2 ---------------------------------------------------------
-- p_voucher_code text → p_voucher_codes text[] (same position), + p_expected_total.
drop function if exists public.place_order(jsonb, text, text, text, text, text, text, text, text, text, text, uuid, uuid, numeric, text, text, text, text);

create function public.place_order(
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
  p_voucher_codes   text[] default null, -- picked at checkout; applied one after another
  p_address_id      uuid default null,
  p_user_id         uuid default null,
  p_shipping_fee    numeric default null,  -- SPX's live quote; NULL = shipping_fee() table
  p_spx_voucher     text default null,     -- the SPX voucher that quote used
  p_delivery_method text default 'standard',  -- 'standard' | 'express'
  p_gacha_code      text default null,     -- one-time prize code from the homepage game
  p_gacha_player    text default null,     -- gacha cookie player key; the +2 order grant lands here
  p_expected_total  numeric default null   -- the total the checkout showed; NULL = no check
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
  v_price          numeric(12,0);
  v_subtotal       numeric(12,0) := 0;
  v_items          jsonb := '[]'::jsonb;
  v_discount       numeric(12,0) := 0;
  v_counts         jsonb := '{}'::jsonb;  -- product_id -> units, for bundle matching
  v_pricing        jsonb;
  v_applied        jsonb := null;
  v_voucher        jsonb;
  v_shipping       numeric(12,0);
  v_ship_discount  numeric(12,0) := 0;
  v_table_fee      numeric(12,0);
  v_total          numeric(12,0);
  v_order_id       uuid;
  v_order_number   text;
  -- flash sale as item price
  v_window         record := public.flash_window();
  v_picks          uuid[] := public.flash_sale_picks();
  -- perks
  v_perks          int := 0;
  v_free_ship      boolean;
  v_gift_qty       int := 0;
  v_gift           record;
  v_gift_missing   boolean := false;
  v_gift_found     boolean := false;
  -- gacha (2026-10-20)
  v_gc             public.gacha_codes%rowtype;
  v_has_gacha      boolean := false;
  v_gacha_discount numeric(12,0) := 0;
  v_gacha_gift     text := null;
  v_cheapest_shirt numeric(12,0) := null;
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
  if p_delivery_method is null or p_delivery_method not in ('standard', 'express') then
    raise exception 'INVALID_DELIVERY_METHOD';
  end if;

  select coalesce(sum(qty), 0) into v_units
    from jsonb_to_recordset(p_items) as x(variant_id uuid, qty int);
  if v_units > c_max_units then
    raise exception 'TOO_MANY_ITEMS';
  end if;

  -- shipping: needs only the city + units, so an unknown city fails before any locking.
  -- A live SPX quote must be a whole amount within 0 … 3 × the table fee, so a bug in the
  -- caller can't charge nonsense.
  v_table_fee := public.shipping_fee(p_city, v_units);
  if p_shipping_fee is null then
    v_shipping := v_table_fee;
  elsif p_shipping_fee < 0 or p_shipping_fee > 3 * v_table_fee or p_shipping_fee <> round(p_shipping_fee) then
    raise exception 'INVALID_SHIPPING_FEE';
  else
    v_shipping := p_shipping_fee;
  end if;

  -- customer (phone) gates ---------------------------------------
  -- Row lock serialises concurrent orders from one phone, so the pending
  -- limit and the once-per-phone promo check below can't be raced.
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

    -- the price charged: the flash price for the window's picks (same rule as quote_order)
    v_price := case when v_window.discount_percent is not null and v_product.id = any (v_picks)
                    then public.flash_unit_price(v_variant.price, v_window.discount_percent) else v_variant.price end;
    v_subtotal := v_subtotal + (v_price * v_item.qty);
    if v_product.earns_perks then
      v_perks := v_perks + v_item.qty;
    end if;
    if v_product.name like 'Áo%' then
      v_cheapest_shirt := least(coalesce(v_cheapest_shirt, v_price), v_price);
    end if;
    v_counts := jsonb_set(v_counts, array[v_product.id::text],
                          to_jsonb(coalesce((v_counts ->> v_product.id::text)::int, 0) + v_item.qty));
    v_items := v_items || jsonb_build_object(
      'product_id',          v_product.id,
      'variant_id',          v_variant.id,
      'name_snapshot',       v_product.name,
      'color_snapshot',      v_variant.color,
      'size_snapshot',       v_variant.size,
      'price_snapshot',      v_price,
      'list_price_snapshot', v_variant.price,
      'image_snapshot',      v_image,
      'sku_snapshot',        v_variant.sku,
      'qty',                 v_item.qty
    );
  end loop;

  -- combo, then the picked vouchers one after another (order_discount, shared with quote_order)
  v_pricing  := public.order_discount(v_phone, v_subtotal, v_counts, p_voucher_codes, true);
  v_discount := (v_pricing ->> 'discount')::numeric;
  v_applied  := nullif(v_pricing -> 'bundles', 'null'::jsonb);

  -- perks: free shipping on standard delivery from 2 units, the gift from 1
  v_free_ship := p_delivery_method = 'standard' and v_perks >= 2;
  if v_free_ship then
    v_ship_discount := v_shipping;
  end if;
  if v_perks >= 1 then
    v_gift_qty := 1;
  end if;

  -- gacha prize code: validated against the charged subtotal. The code row
  -- lock serialises redemption, so one code can never price two orders.
  if p_gacha_code is not null and length(trim(p_gacha_code)) > 0 then
    select * into v_gc from public.gacha_codes
     where code = upper(trim(p_gacha_code)) for update;
    if not found then
      raise exception 'GACHA_INVALID';
    end if;
    if v_gc.status = 'redeemed' then
      raise exception 'GACHA_USED';
    end if;
    if v_gc.status <> 'issued' or v_gc.expires_at <= now() then
      raise exception 'GACHA_EXPIRED';
    end if;
    v_has_gacha := true;

    case v_gc.prize_type
      when 'voucher10' then
        if v_subtotal < 150000 then
          raise exception 'GACHA_MIN_NOT_MET';
        end if;
        v_gacha_discount := 10000;
      when 'voucher20' then
        if v_subtotal < 249000 then
          raise exception 'GACHA_MIN_NOT_MET';
        end if;
        v_gacha_discount := 20000;
      when 'freeship' then
        -- already free (pricing v2): keep the code for a later order
        if v_free_ship then
          v_has_gacha := false;
        else
          v_ship_discount := v_shipping;
        end if;
      when 'socks1' then
        v_gacha_gift := 'Tặng 1 đôi vớ kèm đơn (quà quay thưởng)';
        v_gift_qty := v_gift_qty + 1;
      when 'socks3' then
        v_gacha_gift := 'Tặng bộ 3 đôi vớ kèm đơn (quà quay thưởng)';
        v_gift_qty := v_gift_qty + 3;
      when 'shirt' then
        if v_cheapest_shirt is null then
          raise exception 'GACHA_NO_SHIRT';
        end if;
        v_gacha_discount := v_cheapest_shirt;
      else
        raise exception 'GACHA_INVALID';
    end case;
    -- The prize never makes the merchandise total negative.
    v_gacha_discount := least(v_gacha_discount, v_subtotal - v_discount);
  end if;

  -- the customer was shown a different total (flash window, SPX fee, a code used up)
  v_total := v_subtotal - v_discount - v_gacha_discount + v_shipping - v_ship_discount;
  if p_expected_total is not null and p_expected_total <> v_total then
    raise exception 'PRICE_CHANGED:%', v_total;
  end if;

  -- gift: the same atomic stock guard; short or unset → order goes through, flagged
  if v_gift_qty > 0 then
    update public.product_variants
       set stock = stock - v_gift_qty
     where is_order_gift
       and stock >= v_gift_qty
    returning * into v_variant;
    if found then
      select v.*, p.name, (select storage_path from public.product_images i
                            where i.product_id = p.id and (i.color = v.color or i.color is null)
                            order by (i.color = v.color) desc nulls last, i.is_primary desc, i.sort_order
                            limit 1) as image
        into v_gift
        from public.product_variants v join public.products p on p.id = v.product_id
       where v.id = v_variant.id;
      v_gift_found := true;
    else
      v_gift_missing := true;
    end if;
  end if;

  -- order + items + history + voucher uses --------------------
  v_order_number := 'PZ-' || to_char(now(), 'YYYY') || '-' ||
                    lpad(nextval('public.order_number_seq')::text, 4, '0');

  insert into public.orders (
    order_number, user_id, address_id,
    recipient_name, phone, secondary_phone, email,
    address, ward, district, city, note,
    status, subtotal, discount, shipping_fee, shipping_discount, total, applied_bundles, spx_voucher,
    delivery_method, gacha_discount, gacha_code, gacha_gift, gift_missing
  ) values (
    v_order_number, p_user_id, p_address_id,
    trim(p_recipient_name), v_phone, v_secondary, nullif(trim(p_email), ''),
    trim(p_address), nullif(trim(p_ward), ''), nullif(trim(p_district), ''), trim(p_city),
    nullif(trim(p_note), ''),
    'pending', v_subtotal, v_discount, v_shipping, v_ship_discount, v_total, v_applied,
    case when p_shipping_fee is not null then nullif(trim(p_spx_voucher), '') end,
    p_delivery_method, v_gacha_discount,
    case when v_has_gacha then v_gc.code end,
    v_gacha_gift, v_gift_missing
  ) returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, variant_id, name_snapshot,
    color_snapshot, size_snapshot, price_snapshot, list_price_snapshot, image_snapshot, sku_snapshot, qty
  )
  select v_order_id,
         (i ->> 'product_id')::uuid,
         (i ->> 'variant_id')::uuid,
         i ->> 'name_snapshot',
         i ->> 'color_snapshot',
         i ->> 'size_snapshot',
         (i ->> 'price_snapshot')::numeric,
         (i ->> 'list_price_snapshot')::numeric,
         i ->> 'image_snapshot',
         i ->> 'sku_snapshot',
         (i ->> 'qty')::int
    from jsonb_array_elements(v_items) as i;

  if v_gift_found then
    insert into public.order_items (
      order_id, product_id, variant_id, name_snapshot, color_snapshot, size_snapshot,
      price_snapshot, list_price_snapshot, image_snapshot, sku_snapshot, qty, is_gift
    ) values (
      v_order_id, v_gift.product_id, v_gift.id, v_gift.name, v_gift.color, v_gift.size,
      0, v_gift.price, v_gift.image, v_gift.sku, v_gift_qty, true
    );
  end if;

  insert into public.order_status_history (order_id, status)
  values (v_order_id, 'pending');

  for v_voucher in select * from jsonb_array_elements(v_pricing -> 'vouchers') loop
    -- atomic redemption guard: same shape as the stock guard above. Checking
    -- used_count < max_uses at SELECT time and incrementing later would let two
    -- concurrent orders both redeem the last use.
    update public.vouchers
       set used_count = used_count + 1
     where id = (v_voucher ->> 'id')::uuid
       and (max_uses is null or used_count < max_uses);
    if not found then
      raise exception 'VOUCHER_EXHAUSTED:%', v_voucher ->> 'code';
    end if;

    insert into public.voucher_uses (voucher_id, phone, order_id, voucher_type)
    values ((v_voucher ->> 'id')::uuid, v_phone, v_order_id, (v_voucher ->> 'type')::public.voucher_type);
  end loop;

  if v_has_gacha then
    -- The FOR UPDATE lock above already serialised us; this status guard is
    -- the belt-and-braces twin of the voucher redemption guard.
    update public.gacha_codes
       set status = 'redeemed', redeemed_order_id = v_order_id, redeemed_at = now()
     where id = v_gc.id and status = 'issued';
    if not found then
      raise exception 'GACHA_USED';
    end if;
  end if;

  -- A placed order grants the browser's gacha player +2 game spins (once
  -- per order), when checkout passed the pdz_gacha cookie key. No cookie,
  -- no grant — orders are no longer tied to the game by phone.
  if p_gacha_player is not null and length(trim(p_gacha_player)) > 0 then
    insert into public.gacha_spin_grants (player_key, source, amount, day, order_id)
    values (trim(p_gacha_player), 'order', 2, public.gacha_today(), v_order_id)
    on conflict do nothing;
  end if;

  return jsonb_build_object(
    'order_id',          v_order_id,
    'order_number',      v_order_number,
    'subtotal',          v_subtotal,
    'discount',          v_discount,
    'vouchers',          v_pricing -> 'vouchers',
    'combo',             v_pricing -> 'combo',
    'gacha_discount',    v_gacha_discount,
    'gacha_gift',        v_gacha_gift,
    'gacha_redeemed',    v_has_gacha,
    'shipping_fee',      v_shipping,
    'shipping_discount', v_ship_discount,
    'gift_qty',          case when v_gift_found then v_gift_qty else 0 end,
    'gift_missing',      v_gift_missing,
    'total',             v_total
  );
end $$;

revoke execute on function public.place_order(jsonb, text, text, text, text, text, text, text, text, text, text[], uuid, uuid, numeric, text, text, text, text, numeric) from public, anon, authenticated;
grant  execute on function public.place_order(jsonb, text, text, text, text, text, text, text, text, text, text[], uuid, uuid, numeric, text, text, text, text, numeric) to service_role;

-- vouchers: "Khách mua lần đầu" replaces AUTO-FIRST5 --------------------------
insert into public.vouchers (code, type, discount_pct, is_active, is_listed)
values ('PDZWELCOME', 'standing', 10, true, true)
on conflict (code) do nothing;

-- kept for old orders (voucher_uses reference it); no longer applied anywhere
update public.vouchers set is_active = false, is_listed = false where type = 'auto_first5';

-- catalog defaults on prod (owner, 2026-10-29), so nobody has to tick them in the admin.
-- Matched by SKU: a no-op where they don't exist (local seed, test). The admin can change both later.
-- The gift: QT01's random-colour pair ("[QUÀ TẶNG] Tất vớ …"), unless a gift is already chosen.
update public.product_variants set is_order_gift = true
 where sku = 'Sck1-Random'
   and not exists (select 1 from public.product_variants where is_order_gift);

-- Socks (QT01 gift, QT03 sold) don't count toward free shipping or the gift.
update public.products set earns_perks = false
 where id in (select product_id from public.product_variants where sku in ('Sck1-Random', 'QT03-Random'));
