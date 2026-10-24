-- PDP video (2026-10-24, owner-approved 9726 demo): one optional video per
-- product, shown as the first gallery slide. Plain public URLs (same pattern
-- as description images) so the shop can paste the URL of a video uploaded
-- to the product-images bucket; empty = no video, gallery unchanged.
-- Nullable columns: old code ignores them, so applying before deploy is safe.

alter table public.products
  add column if not exists video_url text null;

alter table public.products
  add column if not exists video_poster_url text null;
