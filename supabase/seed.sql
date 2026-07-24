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
