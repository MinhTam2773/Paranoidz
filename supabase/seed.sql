-- ============================================================
-- Paranoidz — seed data
-- Runs on `supabase db reset`. Non-schema, editable without a migration.
-- ============================================================

-- System voucher backing the automatic first-5-orders discount
-- (ARCHITECTURE.md §5). place_order() looks this up by type, not by code.
-- cap_amount stays NULL (uncapped) until the client resolves §8.3.
insert into public.vouchers (code, type, discount_pct, cap_amount, is_active)
values ('AUTO-FIRST5', 'auto_first5', 10, null, true)
on conflict (code) do nothing;

-- A few SPX wards (spx_locations, ARCHITECTURE.md §5 "SPX Open API") so checkout's ward picker
-- works on a fresh local / CI database. Real environments get SPX's full list from
-- `pnpm --filter @paranoidz/db seed:spx-locations`; these names are SPX's own, so they match it.
insert into public.spx_locations (province, ward) values
  ('Thành phố Hồ Chí Minh', 'Phường Bến Thành'),
  ('Thành phố Hồ Chí Minh', 'Phường Phú Thạnh'),
  ('Thành phố Hà Nội', 'Phường Ba Đình'),
  ('Thành phố Hà Nội', 'Phường Hoàn Kiếm')
on conflict do nothing;
