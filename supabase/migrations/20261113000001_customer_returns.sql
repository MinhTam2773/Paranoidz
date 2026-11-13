-- ============================================================
-- Customer returns (trả hàng). Design: docs/superpowers/specs/2026-11-13-customer-returns-design.md
-- Owner's decisions (2026-11-13):
--   * the customer requests a return online within 7 days of delivery, ticking "not washed" and
--     "tags still attached" and attaching 1–5 photos; return + refund only, no exchange;
--   * the shop books an SPX pickup and pays it; the admin checks the goods on arrival;
--   * COD and bank-transfer orders alike are refunded by hand by the admin, then recorded here.
-- The order itself stays 'delivered' (terminal): returns live in their own tables.
-- Only two functions write here: request_return() (storefront, service role) and
-- transition_return() (admin). transition_return() → 'received' puts the stock back: it is the
-- third function allowed to change stock (CLAUDE.md §4).
-- ============================================================

create type public.return_status as enum
  ('requested', 'approved', 'rejected', 'pickup_booked', 'received', 'refunded', 'cancelled');

create table public.return_requests (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders(id) on delete restrict,
  status          public.return_status not null default 'requested',
  reason          text not null check (reason in ('defect', 'wrong_item', 'not_as_described', 'other')),
  note            text check (char_length(note) <= 500),
  not_washed      boolean not null check (not_washed),
  tags_attached   boolean not null check (tags_attached),
  admin_note      text check (char_length(admin_note) <= 500),   -- shown to the customer when rejected
  spx_tracking_no text unique,                                   -- the SPX pickup shipment
  refund_amount   numeric(12,0) check (refund_amount >= 0),
  refund_note     text check (char_length(refund_note) <= 500),
  created_at      timestamptz not null default now(),
  received_at     timestamptz,
  refunded_at     timestamptz,
  constraint return_requests_other_has_note check (reason <> 'other' or char_length(btrim(note)) > 0)
);

create index return_requests_order_idx on public.return_requests (order_id);
create index return_requests_status_idx on public.return_requests (status, created_at desc);
-- One open request per order at a time.
create unique index return_requests_one_open on public.return_requests (order_id)
  where status in ('requested', 'approved', 'pickup_booked');

create table public.return_items (
  return_id     uuid not null references public.return_requests(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  qty           int not null check (qty > 0),
  primary key (return_id, order_item_id)
);

create index return_items_order_item_idx on public.return_items (order_item_id);

create table public.return_images (
  id           uuid primary key default gen_random_uuid(),
  return_id    uuid not null references public.return_requests(id) on delete cascade,
  storage_path text not null unique,
  sort_order   int not null default 0
);

create index return_images_return_idx on public.return_images (return_id, sort_order);

create table public.return_status_history (
  id         uuid primary key default gen_random_uuid(),
  return_id  uuid not null references public.return_requests(id) on delete cascade,
  status     public.return_status not null,
  note       text,
  created_at timestamptz not null default now()
);

create index return_status_history_return_idx on public.return_status_history (return_id, created_at);

-- Server-only, like orders for guests: the storefront and the admin read and write through the
-- service role. RLS on with no policy = no access for anon / authenticated.
alter table public.return_requests       enable row level security;
alter table public.return_items          enable row level security;
alter table public.return_images         enable row level security;
alter table public.return_status_history enable row level security;
revoke all on public.return_requests, public.return_items, public.return_images, public.return_status_history
  from anon, authenticated;

-- Photos: public bucket like review-images (unguessable uuid paths), images only, 5 MB each.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('return-images', 'return-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- request_return(): the customer's request, every rule re-checked in one transaction.
-- p_items: [{"order_item_id": "<uuid>", "qty": 1}, ...]; p_image_paths: '<uuid>.<jpg|png|webp>'
-- names the storefront already uploaded under return-images/<order_id>/.
-- Errors: ORDER_NOT_FOUND, NOT_ELIGIBLE, WINDOW_CLOSED, OPEN_REQUEST, BAD_ITEMS, BAD_IMAGES,
-- BAD_REASON, CONDITIONS.
-- ------------------------------------------------------------
create function public.request_return(
  p_order_number  text,
  p_phone         text,
  p_reason        text,
  p_note          text,
  p_not_washed    boolean,
  p_tags_attached boolean,
  p_items         jsonb,
  p_image_paths   text[]
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_order        public.orders%rowtype;
  v_delivered_at timestamptz;
  v_return_id    uuid;
  v_note         text := nullif(btrim(coalesce(p_note, '')), '');
  v_bad          int;
  v_lines        int;
begin
  select * into v_order from public.orders
   where order_number = p_order_number and phone = p_phone
   for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if v_order.status <> 'delivered' then
    raise exception 'NOT_ELIGIBLE';
  end if;

  select max(created_at) into v_delivered_at
    from public.order_status_history
   where order_id = v_order.id and status = 'delivered';
  if v_delivered_at is null then
    raise exception 'NOT_ELIGIBLE';
  end if;
  if now() > v_delivered_at + interval '7 days' then
    raise exception 'WINDOW_CLOSED';
  end if;

  if not coalesce(p_not_washed, false) or not coalesce(p_tags_attached, false) then
    raise exception 'CONDITIONS';
  end if;

  if p_reason is null or p_reason not in ('defect', 'wrong_item', 'not_as_described', 'other')
     or (p_reason = 'other' and v_note is null) or char_length(coalesce(v_note, '')) > 500 then
    raise exception 'BAD_REASON';
  end if;

  if coalesce(cardinality(p_image_paths), 0) not between 1 and 5
     or exists (select 1 from unnest(p_image_paths) p
                 where p !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$')
     or (select count(distinct p) from unnest(p_image_paths) p) <> cardinality(p_image_paths) then
    raise exception 'BAD_IMAGES';
  end if;

  if exists (select 1 from public.return_requests
              where order_id = v_order.id and status in ('requested', 'approved', 'pickup_booked')) then
    raise exception 'OPEN_REQUEST';
  end if;

  -- Items: a non-empty array of distinct lines of this order, no gift line, each qty between 1 and
  -- what is still returnable (ordered minus what other live requests already hold).
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'BAD_ITEMS';
  end if;

  select count(*), count(distinct x->>'order_item_id') into v_lines, v_bad
    from jsonb_array_elements(p_items) x;
  if v_bad <> v_lines then
    raise exception 'BAD_ITEMS';
  end if;

  -- qty parsed through CASE so a bad value is BAD_ITEMS, not a cast error.
  select count(*) into v_bad
    from (
      select x->>'order_item_id' as item_id,
             case when jsonb_typeof(x->'qty') = 'number' and (x->>'qty') ~ '^[0-9]{1,6}$'
                  then (x->>'qty')::int end as qty
        from jsonb_array_elements(p_items) x
    ) req
    left join public.order_items oi
      on oi.id::text = req.item_id and oi.order_id = v_order.id and not oi.is_gift
   where oi.id is null
      or req.qty is null
      or req.qty < 1
      or req.qty > oi.qty - coalesce((
           select sum(ri.qty) from public.return_items ri
             join public.return_requests rr on rr.id = ri.return_id
            where ri.order_item_id = oi.id and rr.status not in ('rejected', 'cancelled')), 0);
  if v_bad > 0 then
    raise exception 'BAD_ITEMS';
  end if;

  insert into public.return_requests (order_id, reason, note, not_washed, tags_attached)
  values (v_order.id, p_reason, v_note, true, true)
  returning id into v_return_id;

  insert into public.return_items (return_id, order_item_id, qty)
  select v_return_id, (x->>'order_item_id')::uuid, (x->>'qty')::int
    from jsonb_array_elements(p_items) x;

  insert into public.return_images (return_id, storage_path, sort_order)
  select v_return_id, v_order.id || '/' || p, o - 1
    from unnest(p_image_paths) with ordinality as t(p, o);

  insert into public.return_status_history (return_id, status) values (v_return_id, 'requested');

  return v_return_id;
end $$;

revoke execute on function public.request_return(text, text, text, text, boolean, boolean, jsonb, text[]) from public, anon, authenticated;
grant  execute on function public.request_return(text, text, text, text, boolean, boolean, jsonb, text[]) to service_role;

-- ------------------------------------------------------------
-- transition_return(): the only way a return changes status (admin, or the admin app's service
-- role). Valid moves:
--   requested     → approved | rejected | cancelled
--   approved      → pickup_booked | received | rejected | cancelled
--   pickup_booked → received | rejected | cancelled
--   received      → refunded
-- pickup_booked needs p_spx_tracking_no; rejected needs p_note (shown to the customer);
-- refunded needs p_refund_amount (p_note = refund note). → received restores stock, once.
-- ------------------------------------------------------------
create function public.transition_return(
  p_return_id       uuid,
  p_new_status      public.return_status,
  p_note            text default null,
  p_spx_tracking_no text default null,
  p_refund_amount   numeric default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_return   public.return_requests%rowtype;
  v_is_admin boolean := false;
  v_note     text := nullif(btrim(coalesce(p_note, '')), '');
  v_valid    boolean;
begin
  if auth.role() is distinct from 'service_role' then
    select is_admin into v_is_admin from public.profiles where id = auth.uid();
    if not coalesce(v_is_admin, false) then
      raise exception 'FORBIDDEN';
    end if;
  end if;

  select * into v_return from public.return_requests where id = p_return_id for update;
  if not found then
    raise exception 'RETURN_NOT_FOUND';
  end if;

  v_valid := (v_return.status = 'requested'     and p_new_status in ('approved', 'rejected', 'cancelled'))
          or (v_return.status = 'approved'      and p_new_status in ('pickup_booked', 'received', 'rejected', 'cancelled'))
          or (v_return.status = 'pickup_booked' and p_new_status in ('received', 'rejected', 'cancelled'))
          or (v_return.status = 'received'      and p_new_status = 'refunded');
  if not v_valid then
    raise exception 'INVALID_TRANSITION:%_TO_%', v_return.status, p_new_status;
  end if;

  if char_length(coalesce(v_note, '')) > 500 then
    raise exception 'NOTE_TOO_LONG';
  end if;

  if p_new_status = 'pickup_booked' then
    if nullif(btrim(coalesce(p_spx_tracking_no, '')), '') is null then
      raise exception 'TRACKING_REQUIRED';
    end if;
    update public.return_requests set status = p_new_status, spx_tracking_no = btrim(p_spx_tracking_no)
     where id = p_return_id;

  elsif p_new_status = 'rejected' then
    if v_note is null then
      raise exception 'NOTE_REQUIRED';
    end if;
    update public.return_requests set status = p_new_status, admin_note = v_note where id = p_return_id;

  elsif p_new_status = 'received' then
    update public.return_requests set status = p_new_status, received_at = now() where id = p_return_id;
    -- Stock back, aggregated per variant (several lines may share one; UPDATE ... FROM applies
    -- only one join row per target row). A deleted variant (variant_id null) has nowhere to go.
    update public.product_variants v
       set stock = v.stock + agg.qty
      from (
        select oi.variant_id, sum(ri.qty) as qty
          from public.return_items ri
          join public.order_items oi on oi.id = ri.order_item_id
         where ri.return_id = p_return_id and oi.variant_id is not null
         group by oi.variant_id
      ) agg
     where agg.variant_id = v.id;

  elsif p_new_status = 'refunded' then
    if p_refund_amount is null or p_refund_amount < 0 then
      raise exception 'AMOUNT_REQUIRED';
    end if;
    update public.return_requests
       set status = p_new_status, refund_amount = round(p_refund_amount), refund_note = v_note, refunded_at = now()
     where id = p_return_id;

  else
    update public.return_requests set status = p_new_status where id = p_return_id;
  end if;

  insert into public.return_status_history (return_id, status, note) values (p_return_id, p_new_status, v_note);
end $$;

revoke execute on function public.transition_return(uuid, public.return_status, text, text, numeric) from public, anon;
grant  execute on function public.transition_return(uuid, public.return_status, text, text, numeric) to authenticated, service_role;
