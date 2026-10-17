-- Product marketing fields (2026-10-17, owner request):
--   * shopee_sold_count: manual sold count from the Shopee shop (no Shopee API;
--     the owner updates it in admin). Shown on product cards as "Đã bán X".
--   * gift_label: e.g. "Tặng vớ" — shows a gift badge on the card. The gift
--     itself is fulfilled manually when packing (no auto-add logic yet).

alter table public.products
  add column if not exists shopee_sold_count int not null default 0,
  add column if not exists gift_label text;
