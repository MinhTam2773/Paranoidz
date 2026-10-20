-- Gacha: cookie identity + global daily prize cap (2026-10-20).
-- Follow-up to 20261020000001_gacha_game (PR #26 review): the phone-number
-- gate is removed. A player's identity is now an opaque key the server
-- issues as the `pdz_gacha` cookie (see app/gacha/actions.ts); balances,
-- missions, pity and prize history key on gacha_*.player_key instead of the
-- phone number.
--   * player_key columns are added alongside phone everywhere; existing
--     rows and the phone columns stay as legacy history, untouched. New
--     activity writes player_key only, so phone loses its NOT NULL on the
--     grants / codes / spins tables. gacha_players.phone is the primary
--     key and stays: a cookie player's row stores the key in both columns.
--   * The identity-taking functions are re-created taking p_player_key;
--     the old phone-based signatures are dropped first, so exactly one
--     signature per function name survives (repo rule).
--   * gacha_spin() gains a global daily cap: at most 200 prize codes per
--     VN day across all players (DAILY_CAP, the spin is not consumed).
--   * place_order() gains p_gacha_player as a new last parameter: the +2
--     order grant now lands on that cookie player instead of the order's
--     phone (no cookie, no grant). p_gacha_code redemption is unchanged.
-- Everything stays service-role only, exactly as in 000001.

-- identity columns ---------------------------------------------------------

alter table public.gacha_players     add column if not exists player_key text;
alter table public.gacha_spin_grants add column if not exists player_key text;
alter table public.gacha_codes       add column if not exists player_key text;
alter table public.gacha_spins       add column if not exists player_key text;

-- New activity no longer writes a phone on these three tables.
alter table public.gacha_spin_grants alter column phone drop not null;
alter table public.gacha_codes       alter column phone drop not null;
alter table public.gacha_spins       alter column phone drop not null;

create unique index if not exists gacha_players_player_key_uniq
  on public.gacha_players (player_key);
create index if not exists gacha_grants_player_key_idx
  on public.gacha_spin_grants (player_key);
-- Twin of gacha_grants_daily_uniq, keyed on the cookie identity: one claim
-- per task per day per player.
create unique index if not exists gacha_grants_daily_key_uniq
  on public.gacha_spin_grants (player_key, source, day)
  where source in ('task_view3', 'task_cart', 'task_like', 'task_follow');
create index if not exists gacha_codes_player_key_idx
  on public.gacha_codes (player_key);
create index if not exists gacha_spins_player_key_idx
  on public.gacha_spins (player_key, created_at desc);
-- Supports the daily-cap count in gacha_spin().
create index if not exists gacha_codes_issued_idx
  on public.gacha_codes (issued_at);

-- identity functions: p_phone -> p_player_key ------------------------------
-- Drop first: exactly one signature per function name afterwards.

drop function if exists public.gacha_balance(text);
drop function if exists public.gacha_get_state(text);
drop function if exists public.gacha_spin(text);
drop function if exists public.gacha_claim_task(text, text);

-- Spins left = today's free spin (until used) + unspent grant spins.
create or replace function public.gacha_balance(p_player_key text)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_grants      int;
  v_grant_spins int;
  v_free        int;
begin
  select coalesce(sum(amount), 0) into v_grants
    from public.gacha_spin_grants where player_key = p_player_key;
  select count(*) into v_grant_spins
    from public.gacha_spins where player_key = p_player_key and funded_by = 'grant';
  select case when exists (
           select 1 from public.gacha_spins
            where player_key = p_player_key and funded_by = 'daily_free'
              and (created_at at time zone 'Asia/Ho_Chi_Minh')::date = public.gacha_today()
         ) then 0 else 1 end into v_free;
  return v_free + greatest(v_grants - v_grant_spins, 0);
end $$;

revoke execute on function public.gacha_balance(text) from public, anon, authenticated;
grant execute on function public.gacha_balance(text) to service_role;

-- state ------------------------------------------------------------------

create or replace function public.gacha_get_state(p_player_key text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_key text := nullif(trim(coalesce(p_player_key, '')), '');
  v_today date := public.gacha_today();
begin
  if v_key is null or length(v_key) > 128 then
    raise exception 'INVALID_PLAYER';
  end if;

  insert into public.gacha_players (phone, player_key) values (v_key, v_key) on conflict do nothing;

  return jsonb_build_object(
    'player_key', v_key,
    'spins_left', public.gacha_balance(v_key),
    'tasks_today', coalesce((
      select jsonb_agg(replace(source, 'task_', '') order by source)
        from public.gacha_spin_grants
       where player_key = v_key and day = v_today and source like 'task\_%'
    ), '[]'::jsonb),
    'prizes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'code', code,
               'prize_type', prize_type,
               'tier', tier,
               'status', case when status = 'issued' and expires_at <= now() then 'expired' else status end,
               'expires_at', expires_at,
               'issued_at', issued_at
             ) order by issued_at desc)
        from (select * from public.gacha_codes where player_key = v_key order by issued_at desc limit 20) recent
    ), '[]'::jsonb)
  );
end $$;

revoke execute on function public.gacha_get_state(text) from public, anon, authenticated;
grant execute on function public.gacha_get_state(text) to service_role;

-- spin -------------------------------------------------------------------

create or replace function public.gacha_spin(p_player_key text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_key         text := nullif(trim(coalesce(p_player_key, '')), '');
  v_today       date := public.gacha_today();
  v_free        boolean;
  v_grants      int;
  v_grant_spins int;
  v_funded      text;
  v_pity        boolean := false;
  v_capped      boolean := false;
  v_total       numeric := 0;
  v_roll        numeric;
  v_prize_type  text;
  v_tier        text;
  v_code        text;
  v_code_id     uuid;
  v_expires     timestamptz;
  v_alphabet    constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  c_daily_cap   constant int := 200;  -- prize codes per VN day, all players
  i             int;
  j             int;
begin
  if v_key is null or length(v_key) > 128 then
    raise exception 'INVALID_PLAYER';
  end if;

  insert into public.gacha_players (phone, player_key) values (v_key, v_key) on conflict do nothing;
  -- The player row lock serialises this player's spins and task claims, so the
  -- balance and the caps below can't be raced.
  perform 1 from public.gacha_players where player_key = v_key for update;

  -- Funding: today's free spin first, then grant spins.
  select not exists (
           select 1 from public.gacha_spins
            where player_key = v_key and funded_by = 'daily_free'
              and (created_at at time zone 'Asia/Ho_Chi_Minh')::date = v_today
         ) into v_free;
  select coalesce(sum(amount), 0) into v_grants
    from public.gacha_spin_grants where player_key = v_key;
  select count(*) into v_grant_spins
    from public.gacha_spins where player_key = v_key and funded_by = 'grant';
  if v_free then
    v_funded := 'daily_free';
  elsif v_grants - v_grant_spins > 0 then
    v_funded := 'grant';
  else
    raise exception 'NO_SPINS';
  end if;

  -- Global daily prize cap: at most c_daily_cap prize codes per VN day
  -- across ALL players (codes are only ever created for real prizes, never
  -- for a miss), so the daily prize budget stays bounded even if someone
  -- farms fresh cookie identities. Checked after funding is resolved and
  -- before the draw, so a capped spin is NOT consumed. The count is not
  -- taken under a global lock (the row lock above is per player), so two
  -- spins racing exactly at the boundary can both pass and overshoot by a
  -- hair — accepted: this is a budget guardrail, not a payment control.
  if (select count(*) from public.gacha_codes
       where (issued_at at time zone 'Asia/Ho_Chi_Minh')::date = v_today) >= c_daily_cap then
    raise exception 'DAILY_CAP';
  end if;

  -- Pity: the last 4 spins were all common → draw from rare+ only.
  select count(*) = 4 and bool_and(tier = 'common') into v_pity
    from (select tier from public.gacha_spins
           where player_key = v_key order by created_at desc, id desc limit 4) last4;
  v_pity := coalesce(v_pity, false);

  -- Shirt cap: 2 per calendar month (VN) across all players.
  select count(*) >= 2 into v_capped
    from public.gacha_codes
   where prize_type = 'shirt'
     and (issued_at at time zone 'Asia/Ho_Chi_Minh')
         >= date_trunc('month', now() at time zone 'Asia/Ho_Chi_Minh');

  -- Weighted draw over the pool (weights per the game rules).
  select coalesce(sum(weight), 0) into v_total
    from (values (30.0, 'common'), (25.0, 'common'), (17.0, 'rare'), (15.0, 'rare'),
                 (7.0, 'epic'), (5.5, 'epic'), (0.5, 'legendary')) as t(weight, tier)
   where not v_pity or t.tier <> 'common';
  v_roll := random() * v_total;

  select s.prize_type, s.tier into v_prize_type, v_tier
    from (
      select t.prize_type, t.tier,
             sum(t.weight) over (order by t.ord) as cum
        from (values
          ('voucher10', 'common',    30.0, 1),
          ('miss',      'common',    25.0, 2),
          ('voucher20', 'rare',      17.0, 3),
          ('socks1',    'rare',      15.0, 4),
          ('freeship',  'epic',       7.0, 5),
          ('socks3',    'epic',       5.5, 6),
          ('shirt',     'legendary',  0.5, 7)
        ) as t(prize_type, tier, weight, ord)
       where not v_pity or t.tier <> 'common'
    ) s
   where s.cum > v_roll
   order by s.cum
   limit 1;

  -- A capped shirt draw downgrades to a random epic prize (weights 7 : 5.5).
  if v_prize_type = 'shirt' and v_capped then
    if random() < 7.0 / 12.5 then
      v_prize_type := 'freeship';
    else
      v_prize_type := 'socks3';
    end if;
    v_tier := 'epic';
  end if;

  if v_prize_type <> 'miss' then
    v_expires := now() + interval '7 days';
    for i in 1 .. 10 loop
      v_code := 'GACHA-';
      for j in 1 .. 6 loop
        v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
      end loop;
      begin
        insert into public.gacha_codes (code, player_key, prize_type, tier, expires_at)
        values (v_code, v_key, v_prize_type, v_tier, v_expires)
        returning id into v_code_id;
        exit;
      exception when unique_violation then
        v_code_id := null;  -- astronomically unlikely; draw another code
      end;
    end loop;
    if v_code_id is null then
      raise exception 'CODE_GEN_FAILED';
    end if;
  end if;

  insert into public.gacha_spins (player_key, prize_type, tier, funded_by, code_id)
  values (v_key, v_prize_type, v_tier, v_funded, v_code_id);

  return jsonb_build_object(
    'prize_type', v_prize_type,
    'tier',       v_tier,
    'code',       v_code,
    'expires_at', v_expires,
    'spins_left', public.gacha_balance(v_key)
  );
end $$;

revoke execute on function public.gacha_spin(text) from public, anon, authenticated;
grant execute on function public.gacha_spin(text) to service_role;

-- mission claims -----------------------------------------------------------

create or replace function public.gacha_claim_task(p_player_key text, p_task text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_key        text := nullif(trim(coalesce(p_player_key, '')), '');
  v_today      date := public.gacha_today();
  v_task_today int;
begin
  if v_key is null or length(v_key) > 128 then
    raise exception 'INVALID_PLAYER';
  end if;
  if p_task is null or p_task not in ('view3', 'cart', 'like', 'follow') then
    raise exception 'INVALID_TASK';
  end if;

  insert into public.gacha_players (phone, player_key) values (v_key, v_key) on conflict do nothing;
  perform 1 from public.gacha_players where player_key = v_key for update;

  -- Task spins are capped at +3 per day (order grants don't count).
  select coalesce(sum(amount), 0) into v_task_today
    from public.gacha_spin_grants
   where player_key = v_key and day = v_today and source like 'task\_%';
  if v_task_today + 1 > 3 then
    raise exception 'TASK_CAP';
  end if;

  begin
    insert into public.gacha_spin_grants (player_key, source, amount, day)
    values (v_key, 'task_' || p_task, 1, v_today);
  exception when unique_violation then
    raise exception 'TASK_ALREADY_CLAIMED';
  end;

  return jsonb_build_object('spins_left', public.gacha_balance(v_key));
end $$;

revoke execute on function public.gacha_claim_task(text, text) from public, anon, authenticated;
grant execute on function public.gacha_claim_task(text, text) to service_role;

-- place_order(): + p_gacha_player ------------------------------------------
-- Re-created from 20261020000001 with one change besides the new parameter:
-- the +2 order grant goes to the cookie player (p_gacha_player) instead of
-- the order's phone. Drop the current and the new signature first so
-- exactly one overload exists and re-runs stay idempotent.

drop function if exists public.place_order(jsonb, text, text, text, text, text, text, text, text, text, text, uuid, uuid, numeric, text, text, text);
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
  p_voucher_code    text default null,
  p_address_id      uuid default null,
  p_user_id         uuid default null,
  p_shipping_fee    numeric default null,  -- SPX's live quote; NULL = shipping_fee() table
  p_spx_voucher     text default null,     -- the SPX voucher that quote used
  p_delivery_method text default 'standard',  -- 'standard' | 'express'
  p_gacha_code      text default null,     -- one-time prize code from the homepage game
  p_gacha_player    text default null      -- gacha cookie player key; the +2 order grant lands here
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
  v_table_fee      numeric(12,0);
  v_order_id       uuid;
  v_order_number   text;
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
    if v_product.name like 'Áo%' then
      v_cheapest_shirt := least(coalesce(v_cheapest_shirt, v_variant.price), v_variant.price);
    end if;
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

  -- discount: first-5 vs promo vs bundles, best wins (order_discount, shared with quote_order).
  -- Flash sale option B (2026-10-17): p_items lets it discount only the picked lines.
  v_pricing    := public.order_discount(v_phone, v_subtotal, v_counts, p_voucher_code, p_items);
  v_discount   := (v_pricing ->> 'discount')::numeric;
  v_voucher_id := (v_pricing ->> 'voucher_id')::uuid;
  v_applied    := nullif(v_pricing -> 'bundles', 'null'::jsonb);

  -- gacha prize code: validated against the recomputed subtotal. The code row
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
        v_shipping := 0;
      when 'socks1' then
        v_gacha_gift := 'Tặng 1 đôi vớ kèm đơn (quà quay thưởng)';
      when 'socks3' then
        v_gacha_gift := 'Tặng bộ 3 đôi vớ kèm đơn (quà quay thưởng)';
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

  -- order + items + history + voucher use --------------------
  v_order_number := 'PZ-' || to_char(now(), 'YYYY') || '-' ||
                    lpad(nextval('public.order_number_seq')::text, 4, '0');

  insert into public.orders (
    order_number, user_id, address_id,
    recipient_name, phone, secondary_phone, email,
    address, ward, district, city, note,
    status, subtotal, discount, shipping_fee, total, applied_bundles, spx_voucher,
    delivery_method, gacha_discount, gacha_code, gacha_gift
  ) values (
    v_order_number, p_user_id, p_address_id,
    trim(p_recipient_name), v_phone, v_secondary, nullif(trim(p_email), ''),
    trim(p_address), nullif(trim(p_ward), ''), nullif(trim(p_district), ''), trim(p_city),
    nullif(trim(p_note), ''),
    'pending', v_subtotal, v_discount, v_shipping,
    v_subtotal - v_discount - v_gacha_discount + v_shipping, v_applied,
    case when p_shipping_fee is not null then nullif(trim(p_spx_voucher), '') end,
    p_delivery_method, v_gacha_discount,
    case when v_has_gacha then v_gc.code end,
    v_gacha_gift
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
    'order_id',       v_order_id,
    'order_number',   v_order_number,
    'subtotal',       v_subtotal,
    'discount',       v_discount,
    'gacha_discount', v_gacha_discount,
    'gacha_gift',     v_gacha_gift,
    'shipping_fee',   v_shipping,
    'total',          v_subtotal - v_discount - v_gacha_discount + v_shipping
  );
end $$;

revoke execute on function public.place_order(jsonb, text, text, text, text, text, text, text, text, text, text, uuid, uuid, numeric, text, text, text, text) from public, anon, authenticated;
grant  execute on function public.place_order(jsonb, text, text, text, text, text, text, text, text, text, text, uuid, uuid, numeric, text, text, text, text) to service_role;
