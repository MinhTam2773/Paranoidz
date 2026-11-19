-- Free shipping campaign (2026-11-19, owner): between starts_at and ends_at every
-- standard-delivery order ships free, whatever its amount. Outside the window the
-- pricing v2 rule stays (₫199.000+ after combo and vouchers). Express never ships free.
-- One campaign at a time: a single row, set from the admin (Mã giảm giá page).

create table public.free_ship_campaign (
  id         boolean primary key default true check (id),
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  updated_at timestamptz not null default now(),
  constraint free_ship_campaign_window check (ends_at > starts_at)
);

-- RLS on, no policies: read and written with the service role only.
alter table public.free_ship_campaign enable row level security;

-- Same signature (grants kept). Now reads a table, so stable instead of immutable;
-- quote_order() and place_order() both call it, so the preview can't drift from the charge.
create or replace function public.ships_free(p_delivery_method text, p_amount numeric)
returns boolean
language sql stable set search_path = public
as $$
  select coalesce(p_delivery_method, 'standard') = 'standard'
     and (p_amount >= 199000
          or exists (select 1 from public.free_ship_campaign c
                      where now() >= c.starts_at and now() < c.ends_at));
$$;
