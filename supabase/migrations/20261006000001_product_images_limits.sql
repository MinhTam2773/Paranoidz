-- Admin image uploader (2026-10-06): photos go browser → Storage with a signed
-- upload URL issued by an admin server action, so the server never sees the
-- bytes. The bucket itself enforces type and size for every upload path.
update storage.buckets
   set file_size_limit    = 10485760,  -- 10 MB
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'product-images';
