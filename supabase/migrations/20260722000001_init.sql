-- ============================================================
-- Paranoidz — Initial Schema Migration
-- File: supabase/migrations/20260722000001_init.sql
-- Implements ARCHITECTURE.md section 7 + ERD review fixes.
-- ============================================================

-- ---------- EXTENSIONS ----------
-- Supabase pre-installs extensions into the `extensions` schema; creating them
-- into `public` silently no-ops and leaves public.unaccent() unresolvable.
create extension if not exists unaccent with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- unaccent() is not IMMUTABLE; wrap it so it can be used in an index.
create or replace function public.immutable_unaccent(text)
returns text
language sql immutable parallel safe strict
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, $1) $$;

-- ---------- ENUMS ----------
create type public.order_status as enum
  ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'delivery_failed');

create type public.voucher_type as enum ('auto_first5', 'promo');

create type public.award_status as enum ('pending', 'fulfilled');

-- ---------- SEQUENCES ----------
-- Continuous sequence; year prefix in order_number is cosmetic.
create sequence public.order_number_seq start 1;

-- ---------- TABLES: CATALOG ----------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create table public.products (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text not null unique,
  description       text,
  care_instructions text,
  size_guide        jsonb,
  category_id       uuid references public.categories(id) on delete set null,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.product_variants (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products(id) on delete cascade,
  color          text not null,
  size           text not null,
  price          numeric(12,0) not null check (price > 0),
  original_price numeric(12,0) check (original_price is null or original_price > 0),
  stock          int not null default 0 check (stock >= 0),
  sku            text unique,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (product_id, color, size)
);

create table public.product_images (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products(id) on delete cascade,
  color        text,                       -- matches product_variants.color; NULL = general image
  storage_path text not null,
  sort_order   int not null default 0,
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ---------- TABLES: CUSTOMER ----------
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  full_name       text not null default '',
  phone           text,                    -- unique when present (partial index below)
  delivered_count int not null default 0 check (delivered_count >= 0),
  refusal_count   int not null default 0 check (refusal_count >= 0),
  is_blacklisted  boolean not null default false,
  is_admin        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index profiles_phone_unique on public.profiles (phone) where phone is not null;

create table public.addresses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  name       text not null,
  phone      text not null,
  address    text not null,
  ward       text,
  district   text,
  city       text not null,
  label      text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index addresses_one_default_per_user
  on public.addresses (user_id) where is_default = true;

-- ---------- TABLES: ORDERS ----------
create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  order_number     text not null unique,
  user_id          uuid not null references public.profiles(id) on delete restrict,
  address_id       uuid references public.addresses(id) on delete set null,
  -- address snapshot (source of truth for fulfillment)
  recipient_name   text not null,
  phone            text not null,
  secondary_phone  text,
  email            text,
  address          text not null,
  ward             text,
  district         text,
  city             text not null,
  note             text,
  status           public.order_status not null default 'pending',
  subtotal         numeric(12,0) not null check (subtotal >= 0),
  discount         numeric(12,0) not null default 0 check (discount >= 0),
  total            numeric(12,0) not null check (total >= 0),
  created_at       timestamptz not null default now(),
  constraint orders_total_math check (total = subtotal - discount)
);

create index orders_user_idx    on public.orders (user_id);
create index orders_status_idx  on public.orders (status);
create index orders_created_idx on public.orders (created_at desc);

create table public.order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders(id) on delete cascade,
  product_id     uuid references public.products(id) on delete set null,
  variant_id     uuid references public.product_variants(id) on delete set null,
  name_snapshot  text not null,
  color_snapshot text,
  size_snapshot  text,
  price_snapshot numeric(12,0) not null,
  image_snapshot text,
  qty            int not null check (qty > 0)
);

create index order_items_order_idx on public.order_items (order_id);

create table public.order_status_history (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  status     public.order_status not null,
  note       text,
  created_at timestamptz not null default now()
);

create index order_status_history_order_idx on public.order_status_history (order_id);

-- ---------- TABLES: REVIEWS / WISHLIST ----------
create table public.reviews (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  rating     int not null check (rating between 1 and 5),
  content    text not null,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create index reviews_product_visible_idx on public.reviews (product_id) where is_visible = true;

create table public.review_replies (
  id             uuid primary key default gen_random_uuid(),
  review_id      uuid not null references public.reviews(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  content        text not null,
  is_brand_reply boolean not null default false,
  created_at     timestamptz not null default now()
);

create table public.wishlists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  added_at   timestamptz not null default now(),
  unique (user_id, product_id)
);

create index wishlists_user_idx on public.wishlists (user_id);

-- ---------- TABLES: VOUCHERS ----------
create table public.vouchers (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  type         public.voucher_type not null default 'promo',
  discount_pct int not null check (discount_pct between 1 and 100),
  cap_amount   numeric(12,0) check (cap_amount is null or cap_amount > 0),
  max_uses     int check (max_uses is null or max_uses > 0),
  used_count   int not null default 0 check (used_count >= 0),
  is_active    boolean not null default true,
  expires_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.voucher_uses (
  id           uuid primary key default gen_random_uuid(),
  voucher_id   uuid not null references public.vouchers(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  order_id     uuid not null references public.orders(id) on delete cascade,
  -- denormalised from vouchers.type so the one-per-user rule below can be a
  -- partial unique index (index predicates cannot reference another table).
  voucher_type public.voucher_type not null,
  released_at  timestamptz,
  created_at   timestamptz not null default now(),
  unique (order_id)                       -- one voucher per order, no stacking
);

-- A promo code is redeemable once per customer. Cancelled / refused orders set
-- released_at, which frees the slot again. auto_first5 is exempt (5 orders).
create unique index voucher_uses_one_promo_per_user
  on public.voucher_uses (voucher_id, user_id)
  where voucher_type = 'promo' and released_at is null;

-- ---------- TABLES: BUNDLES / COLLECTIONS ----------
create table public.bundles (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  discount_amount numeric(12,0) not null check (discount_amount >= 0),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.bundle_items (
  id         uuid primary key default gen_random_uuid(),
  bundle_id  uuid not null references public.bundles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  unique (bundle_id, product_id)
);

create table public.collections (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  sort_order int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.collection_items (
  id            uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  product_id    uuid not null references public.products(id) on delete cascade,
  sort_order    int not null default 0,
  unique (collection_id, product_id)
);

create index collection_items_idx on public.collection_items (collection_id, sort_order);

-- ---------- TABLES: LOYALTY ----------
create table public.loyalty_gifts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  image_url   text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.loyalty_awards (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  gift_id    uuid references public.loyalty_gifts(id) on delete set null,  -- NULL = banked, pool was empty
  milestone  int not null check (milestone > 0),
  status     public.award_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (user_id, milestone)
);

-- ---------- FULL-TEXT SEARCH ----------
create index products_fts_idx on public.products using gin (
  to_tsvector('simple',
    public.immutable_unaccent(coalesce(name, '') || ' ' || coalesce(description, '')))
);

-- ---------- updated_at TRIGGER ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_products_updated    before update on public.products         for each row execute function public.set_updated_at();
create trigger trg_variants_updated    before update on public.product_variants for each row execute function public.set_updated_at();
create trigger trg_profiles_updated    before update on public.profiles         for each row execute function public.set_updated_at();
create trigger trg_vouchers_updated    before update on public.vouchers         for each row execute function public.set_updated_at();
create trigger trg_bundles_updated     before update on public.bundles          for each row execute function public.set_updated_at();
create trigger trg_collections_updated before update on public.collections      for each row execute function public.set_updated_at();

-- ---------- AUTO-CREATE PROFILE ON SIGNUP ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- FUNCTION: place_order
-- The ONLY write path for orders. Atomic: stock guard + insert.
-- Called from a server route with the user's session client.
-- ============================================================
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
  p_address_id      uuid default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_user           uuid := auth.uid();
  v_profile        public.profiles%rowtype;
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
  -- auth & fraud gates ---------------------------------------
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_profile from public.profiles where id = v_user;
  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;
  if v_profile.is_blacklisted then
    raise exception 'BLACKLISTED';
  end if;
  if v_profile.phone is null then
    raise exception 'PHONE_REQUIRED';  -- profile must have unique phone before first order
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_ORDER';
  end if;
  if p_recipient_name is null or p_phone is null or p_address is null or p_city is null then
    raise exception 'MISSING_DELIVERY_FIELDS';
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
   where user_id = v_user
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

    -- one redemption per customer; the partial unique index on voucher_uses is
    -- the real guard, this is only here to return a legible error.
    if exists (
      select 1 from public.voucher_uses
       where voucher_id = v_promo_voucher.id
         and user_id = v_user
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
    v_order_number, v_user, p_address_id,
    p_recipient_name, p_phone, p_secondary_phone, p_email,
    p_address, p_ward, p_district, p_city, p_note,
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

    insert into public.voucher_uses (voucher_id, user_id, order_id, voucher_type)
    select v_voucher_id, v_user, v_order_id, type
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

-- ============================================================
-- FUNCTION: transition_order_status
-- The ONLY write path for status changes. Restores stock,
-- maintains counters, awards loyalty gifts, writes history.
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

  -- refusal tracking
  if p_new_status = 'delivery_failed' then
    update public.profiles
       set refusal_count = refusal_count + 1
     where id = v_order.user_id;
  end if;

  -- loyalty: delivered counter + milestone gift
  if p_new_status = 'delivered' then
    update public.profiles
       set delivered_count = delivered_count + 1
     where id = v_order.user_id
    returning delivered_count into v_new_count;

    if v_new_count % 10 = 0 then
      select id into v_gift_id from public.loyalty_gifts
       where is_active = true
       order by random() limit 1;   -- NULL if pool empty → banked award

      insert into public.loyalty_awards (user_id, gift_id, milestone)
      values (v_order.user_id, v_gift_id, v_new_count)
      on conflict (user_id, milestone) do nothing;
    end if;
  end if;
end $$;

-- ---------- FUNCTION GRANTS ----------
revoke execute on function public.place_order(jsonb, text, text, text, text, text, text, text, text, text, text, uuid) from public, anon;
grant  execute on function public.place_order(jsonb, text, text, text, text, text, text, text, text, text, text, uuid) to authenticated;

revoke execute on function public.transition_order_status(uuid, public.order_status, text) from public, anon;
grant  execute on function public.transition_order_status(uuid, public.order_status, text) to authenticated, service_role;

-- ============================================================
-- ROW LEVEL SECURITY
-- Deny-by-default: RLS enabled everywhere; only listed
-- policies grant access. Admin app uses service_role (bypasses).
-- ============================================================
alter table public.categories           enable row level security;
alter table public.products             enable row level security;
alter table public.product_variants     enable row level security;
alter table public.product_images       enable row level security;
alter table public.profiles             enable row level security;
alter table public.addresses            enable row level security;
alter table public.orders               enable row level security;
alter table public.order_items          enable row level security;
alter table public.order_status_history enable row level security;
alter table public.reviews              enable row level security;
alter table public.review_replies       enable row level security;
alter table public.wishlists            enable row level security;
alter table public.vouchers             enable row level security;
alter table public.voucher_uses         enable row level security;
alter table public.bundles              enable row level security;
alter table public.bundle_items         enable row level security;
alter table public.collections          enable row level security;
alter table public.collection_items     enable row level security;
alter table public.loyalty_gifts        enable row level security;
alter table public.loyalty_awards       enable row level security;

-- catalog: public read (active rows) ------------------------
create policy categories_public_read on public.categories
  for select using (true);

create policy products_public_read on public.products
  for select using (is_active = true);

create policy variants_public_read on public.product_variants
  for select using (
    exists (select 1 from public.products p where p.id = product_id and p.is_active)
  );

create policy images_public_read on public.product_images
  for select using (
    exists (select 1 from public.products p where p.id = product_id and p.is_active)
  );

create policy collections_public_read on public.collections
  for select using (is_active = true);

create policy collection_items_public_read on public.collection_items
  for select using (
    exists (select 1 from public.collections c where c.id = collection_id and c.is_active)
  );

create policy bundles_public_read on public.bundles
  for select using (is_active = true);

create policy bundle_items_public_read on public.bundle_items
  for select using (
    exists (select 1 from public.bundles b where b.id = bundle_id and b.is_active)
  );

-- reviews: public read of visible ---------------------------
create policy reviews_public_read on public.reviews
  for select using (is_visible = true);

create policy review_replies_public_read on public.review_replies
  for select using (
    exists (select 1 from public.reviews r where r.id = review_id and r.is_visible)
  );

-- profiles: own row ------------------------------------------
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- column-level: customers may change only name + phone
revoke update on public.profiles from authenticated;
grant  update (full_name, phone) on public.profiles to authenticated;

-- addresses / wishlists: full CRUD on own rows ---------------
create policy addresses_own on public.addresses
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy wishlists_own on public.wishlists
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- orders: read own; NO insert/update policy (server-only) ----
create policy orders_select_own on public.orders
  for select using (user_id = auth.uid());

create policy order_items_select_own on public.order_items
  for select using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  );

create policy order_history_select_own on public.order_status_history
  for select using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  );

-- vouchers / voucher_uses / loyalty_*: no client access at all
-- (deny-by-default: RLS on, zero policies)
