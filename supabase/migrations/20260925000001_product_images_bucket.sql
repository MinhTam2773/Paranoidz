-- Public bucket for product photos (product_images.storage_path is relative to it).
-- Public = objects readable by URL without storage RLS. No write policies:
-- uploads are service-role only until the admin image uploader adds them.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;
