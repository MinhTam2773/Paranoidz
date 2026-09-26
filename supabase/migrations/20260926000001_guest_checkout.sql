-- ============================================================
-- Guest checkout (ARCHITECTURE.md §8.2, resolved 2026-09-26): no account needed to order.
-- Every per-customer rule is keyed on the normalized phone ONLY (client decision):
-- blacklist + refusal count, first-5 voucher, promo once per customer, loyalty.
-- ============================================================

-- ---------- phone normalization ----------
-- '+84 90 123 4567', '090.123.4567', '0901234567' -> '0901234567'. VN mobiles only
-- (10 digits, 03/05/07/08/09). NULL = invalid.
create or replace function public.normalize_vn_phone(p text)
returns text
language sql immutable parallel safe
as $$
  select case
           when d ~ '^0[35789][0-9]{8}$'  then d
           when d ~ '^84[35789][0-9]{8}$' then '0' || substr(d, 3)
         end
    from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as d) s
$$;

-- ---------- customers: one row per phone ----------
create table public.customers (
  phone           text primary key check (phone = public.normalize_vn_phone(phone)),
  delivered_count int not null default 0 check (delivered_count >= 0),
  refusal_count   int not null default 0 check (refusal_count >= 0),
  is_blacklisted  boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_customers_updated before update on public.customers
  for each row execute function public.set_updated_at();

-- No client access at all (deny-by-default): server routes / admin only.
alter table public.customers enable row level security;

-- ---------- orders: guests have no user ----------
alter table public.orders alter column user_id drop not null;

update public.orders
   set phone = public.normalize_vn_phone(phone)
 where public.normalize_vn_phone(phone) is not null
   and phone <> public.normalize_vn_phone(phone);

create index orders_phone_idx on public.orders (phone);

insert into public.customers (phone)
select distinct phone from public.orders where public.normalize_vn_phone(phone) = phone
on conflict do nothing;

-- ---------- voucher_uses: once per phone, not per account ----------
alter table public.voucher_uses add column phone text;
update public.voucher_uses vu set phone = o.phone from public.orders o where o.id = vu.order_id;
alter table public.voucher_uses alter column phone set not null;

drop index public.voucher_uses_one_promo_per_user;
alter table public.voucher_uses drop column user_id;

-- A promo code is redeemable once per phone. Cancelled / refused orders set
-- released_at, which frees the slot again. auto_first5 is exempt (5 orders).
create unique index voucher_uses_one_promo_per_phone
  on public.voucher_uses (voucher_id, phone)
  where voucher_type = 'promo' and released_at is null;

-- ---------- loyalty_awards: per phone ----------
do $$
begin
  if exists (select 1 from public.loyalty_awards) then
    raise exception 'loyalty_awards has rows: map user_id -> phone by hand before this migration';
  end if;
end $$;

alter table public.loyalty_awards drop column user_id;
alter table public.loyalty_awards
  add column phone text not null references public.customers(phone) on delete cascade,
  add constraint loyalty_awards_phone_milestone_key unique (phone, milestone);

-- ---------- profiles: counters moved to customers ----------
alter table public.profiles
  drop column delivered_count,
  drop column refusal_count,
  drop column is_blacklisted;

-- ============================================================
-- FUNCTION: place_order (replaces the account-only version)
-- The ONLY write path for orders. Atomic: stock guard + insert.
-- Called ONLY by the storefront order route with the service-role client;
-- p_user_id is the verified session user (NULL for guests).
-- ============================================================
drop function public.place_order(jsonb, text, text, text, text, text, text, text, text, text, text, uuid);

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

  -- order + items + history + voucher use --------------------
  v_order_number := 'PZ-' || to_char(now(), 'YYYY') || '-' ||
                    lpad(nextval('public.order_number_seq')::text, 4, '0');

  insert into public.orders (
    order_number, user_id, address_id,
    recipient_name, phone, secondary_phone, email,
    address, ward, district, city, note,
    status, subtotal, discount, total
  ) values (
    v_order_number, p_user_id, p_address_id,
    trim(p_recipient_name), v_phone, v_secondary, nullif(trim(p_email), ''),
    trim(p_address), nullif(trim(p_ward), ''), nullif(trim(p_district), ''), trim(p_city),
    nullif(trim(p_note), ''),
    'pending', v_subtotal, v_discount, v_subtotal - v_discount
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

-- Server-only: the order route calls it with the service-role client after its own
-- validation + rate limiting. Browsers (anon or signed in) can no longer call it.
revoke execute on function public.place_order(jsonb, text, text, text, text, text, text, text, text, text, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.place_order(jsonb, text, text, text, text, text, text, text, text, text, text, uuid, uuid)
  to service_role;

-- ============================================================
-- FUNCTION: transition_order_status — counters now per phone
-- ============================================================
create or replace function public.transition_order_status(
  p_order_id   uuid,
  p_new_status public.order_status,
  p_note       text default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_order      public.orders%rowtype;
  v_caller     uuid := auth.uid();
  v_is_admin   boolean := false;
  v_new_count  int;
  v_gift_id    uuid;
  v_valid      boolean := false;
begin
  -- only admin (or service_role from admin server routes)
  if auth.role() is distinct from 'service_role' then
    select is_admin into v_is_admin from public.profiles where id = v_caller;
    if not coalesce(v_is_admin, false) then
      raise exception 'FORBIDDEN';
    end if;
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  -- valid transitions only
  v_valid := (v_order.status = 'pending'   and p_new_status in ('confirmed', 'cancelled'))
          or (v_order.status = 'confirmed' and p_new_status in ('shipped', 'cancelled'))
          or (v_order.status = 'shipped'   and p_new_status in ('delivered', 'delivery_failed'));
  if not v_valid then
    raise exception 'INVALID_TRANSITION:%_TO_%', v_order.status, p_new_status;
  end if;

  update public.orders set status = p_new_status where id = p_order_id;

  insert into public.order_status_history (order_id, status, note)
  values (p_order_id, p_new_status, p_note);

  -- stock restoration + voucher slot release
  if p_new_status in ('cancelled', 'delivery_failed') then
    -- aggregate first: an order may hold several rows for the same variant, and
    -- UPDATE ... FROM applies only one arbitrary join row per target row.
    update public.product_variants v
       set stock = v.stock + agg.qty
      from (
        select variant_id, sum(qty) as qty
          from public.order_items
         where order_id = p_order_id and variant_id is not null
         group by variant_id
      ) agg
     where agg.variant_id = v.id;

    update public.voucher_uses
       set released_at = now()
     where order_id = p_order_id and released_at is null;

    update public.vouchers vc
       set used_count = greatest(used_count - 1, 0)
      from public.voucher_uses vu
     where vu.order_id = p_order_id and vu.voucher_id = vc.id;
  end if;

  -- refusal tracking (per phone)
  if p_new_status = 'delivery_failed' then
    insert into public.customers (phone, refusal_count) values (v_order.phone, 1)
    on conflict (phone) do update set refusal_count = public.customers.refusal_count + 1;
  end if;

  -- loyalty: delivered counter + milestone gift (per phone)
  if p_new_status = 'delivered' then
    insert into public.customers (phone, delivered_count) values (v_order.phone, 1)
    on conflict (phone) do update set delivered_count = public.customers.delivered_count + 1
    returning delivered_count into v_new_count;

    if v_new_count % 10 = 0 then
      select id into v_gift_id from public.loyalty_gifts
       where is_active = true
       order by random() limit 1;   -- NULL if pool empty → banked award

      insert into public.loyalty_awards (phone, gift_id, milestone)
      values (v_order.phone, v_gift_id, v_new_count)
      on conflict (phone, milestone) do nothing;
    end if;
  end if;
end $$;
