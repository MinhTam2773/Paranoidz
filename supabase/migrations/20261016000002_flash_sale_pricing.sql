-- Flash sale pricing (2026-10-16): during an active flash_sale_windows window
-- (evaluated in Asia/Ho_Chi_Minh) orders get an EXTRA discount_pct off the subtotal,
-- stacking on top of voucher/bundle discounts. order_discount() is shared by
-- place_order() and the checkout quote, so both stay consistent.

create or replace function public.active_flash_sale_discount()
returns int
language plpgsql set search_path = public
as $$
declare
  v_vn   time := (now() at time zone 'Asia/Ho_Chi_Minh')::time;
  v_pct  int := 0;
  v_start time;
  v_end   time;
begin
  for v_pct, v_start, v_end in
    select w.discount_percent,
           make_time(w.start_hour, 0, 0),
           (make_time(w.start_hour, 0, 0) + (w.duration_minutes || ' minutes')::interval)::time
      from public.flash_sale_windows w
     where w.enabled
     order by w.start_hour
  loop
    if v_end > v_start then
      -- window inside one day
      if v_vn >= v_start and v_vn < v_end then return v_pct; end if;
    else
      -- window crosses midnight
      if v_vn >= v_start or v_vn < v_end then return v_pct; end if;
    end if;
  end loop;
  return 0;
end $$;

-- order_discount(): body from 20261011000002_order_quote.sql + flash sale stacking.
create or replace function public.order_discount(p_phone text, p_subtotal numeric, p_counts jsonb, p_voucher_code text)
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

  -- flash sale (2026-10-16): extra % off during an active window, stacks on top.
  v_flash_pct := public.active_flash_sale_discount();
  if v_flash_pct > 0 then
    v_flash_discount := floor(p_subtotal * v_flash_pct / 100.0);
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

revoke execute on function public.order_discount(text, numeric, jsonb, text) from public, anon, authenticated;
