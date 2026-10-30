-- Admin video upload (2026-10-30): the product video (products.video_url, 20261024000002) is
-- uploaded from the admin like photos — browser → Storage through a signed upload URL — instead
-- of pasting a URL. The bucket enforces type and size for every path, so it must accept MP4 /
-- WebM. 50 MB is the Supabase free plan's per-file ceiling; photos stay capped at 10 MB by the
-- admin server actions (image-actions.ts) and are compressed in the browser before upload.
update storage.buckets
   set file_size_limit    = 52428800,  -- 50 MB
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
 where id = 'product-images';
