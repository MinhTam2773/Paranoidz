-- Optional collection subtitle, shown under the title on the storefront collection page
-- (Stitch "Outlet 2026"; spec 2026-10-11 §4). Edited in the admin collection form.
alter table public.collections
  add column description text check (char_length(description) <= 300);
