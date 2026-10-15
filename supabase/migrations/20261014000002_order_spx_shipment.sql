-- ============================================================
-- SPX shipment on the order — ARCHITECTURE.md §5 "SPX Open API", decided 2026-10-15.
-- Written only by the admin app's server action (service role, after requireAdmin())
-- when it creates the SPX order. Browsers can't write orders at all (no UPDATE policy;
-- smoke case 18). The label link is never stored (valid 30 minutes / 10 opens).
-- ============================================================

alter table public.orders
  add column spx_tracking_no text unique,
  add column spx_ward        text,                                  -- spx_locations.ward the shipment was created with
  add column spx_fee         numeric(12,0) check (spx_fee >= 0),    -- SPX's estimate at creation, to compare with shipping_fee
  add column spx_created_at  timestamptz;
