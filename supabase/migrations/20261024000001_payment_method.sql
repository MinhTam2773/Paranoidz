-- Payment method chosen by the customer (2026-10-24, owner request):
--   'cod'           = Cash on delivery (default, unchanged behavior)
--   'bank_transfer' = Manual bank transfer via VietQR. A transfer order is NOT
--                     a new order_status: "awaiting payment confirmation" is
--                     derived in the app as payment_method='bank_transfer' AND
--                     payment_confirmed_at IS NULL. Admin confirms receipt by
--                     setting payment_confirmed_at; the order then follows the
--                     normal pending -> confirmed -> shipped flow.
-- No enum change: ALTER TYPE ... ADD VALUE cannot run in a transaction block
-- and the app code referencing a not-yet-migrated enum value would break
-- transfer orders at runtime before the migration lands.

alter table public.orders
  add column if not exists payment_method text not null default 'cod'
  check (payment_method in ('cod', 'bank_transfer'));

alter table public.orders
  add column if not exists payment_confirmed_at timestamptz null;
