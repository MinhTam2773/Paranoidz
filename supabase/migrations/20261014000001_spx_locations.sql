-- ============================================================
-- SPX locations — ARCHITECTURE.md §5 "SPX Open API", decided 2026-10-15.
-- * SPX's own province / ward names (2-level address, address_version 2). SPX accepts
--   either spelling of the province, but the ward must match SPX's name exactly.
-- * Copied from SPX's public location list by packages/db/scripts/spx-locations.ts
--   (service role); re-run the script when SPX changes its list.
-- * Public read: it is SPX's public address list (checkout's ward picker, admin).
-- ============================================================

create table public.spx_locations (
  province text not null,  -- SPX's name: "Thành phố Hồ Chí Minh", "Tỉnh Cao Bằng"
  ward     text not null,  -- SPX's name: "Phường Phú Thạnh", "Xã Hát Môn"
  primary key (province, ward)
);

alter table public.spx_locations enable row level security;

create policy spx_locations_public_read on public.spx_locations
  for select using (true);
