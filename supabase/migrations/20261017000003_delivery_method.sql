-- Delivery method chosen by the customer (2026-10-17, owner request):
--   'standard' = Giao thường (SPX standard, service_type 1)
--   'express'  = Hoả tốc nội thành HCM (SPX express service_type TBD —
--                waiting on SPX for the exact code; shop fulfills manually meanwhile)

alter table public.orders
  add column if not exists delivery_method text not null default 'standard'
  check (delivery_method in ('standard', 'express'));
