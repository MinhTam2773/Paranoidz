-- Flash sale windows (2026-10-16): daily 1-hour windows (VN time) with an extra
-- discount during the window. Admin edits rows in Supabase; the storefront reads
-- enabled windows and computes active/next in Asia/Ho_Chi_Minh.

create table public.flash_sale_windows (
  id               uuid primary key default gen_random_uuid(),
  start_hour       int not null check (start_hour between 0 and 23),
  duration_minutes int not null default 60 check (duration_minutes > 0 and duration_minutes <= 720),
  discount_percent int not null default 10 check (discount_percent between 1 and 90),
  enabled          boolean not null default true,
  created_at       timestamptz not null default now(),
  unique (start_hour)
);

-- Tủn's daily windows: 0h, 9h, 12h, 15h, 18h, 21h (VN time), extra 10% off.
insert into public.flash_sale_windows (start_hour) values (0), (9), (12), (15), (18), (21);

alter table public.flash_sale_windows enable row level security;

-- Public read of enabled windows (storefront countdown + pricing).
create policy flash_sale_windows_public_read on public.flash_sale_windows
  for select using (enabled = true);
