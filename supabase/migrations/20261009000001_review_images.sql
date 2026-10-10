-- ============================================================
-- Review photos. Owner's decisions (2026-10-09):
--   * a customer attaches up to 4 photos to their own review, JPEG / PNG / WebP, 5 MB each;
--   * the admin hides / shows each photo on its own; hiding the review hides its photos too.
-- Bytes go browser → Storage through a signed upload URL issued by a storefront server action
-- (path <user_id>/<review_id>/<uuid>.<ext>). Rows are written ONLY by server code with the
-- service role, after it checks the review is the caller's and the object exists: customers
-- get no insert / update / delete grant here, just read access through RLS.
-- The bucket is public like product-images, so a hidden photo leaves the page but its URL
-- (an unguessable uuid) still resolves.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('review-images', 'review-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create table public.review_images (
  id           uuid primary key default gen_random_uuid(),
  review_id    uuid not null references public.reviews(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  sort_order   int not null default 0,
  is_visible   boolean not null default true,
  created_at   timestamptz not null default now()
);

create index review_images_review_idx on public.review_images (review_id, sort_order);

alter table public.review_images enable row level security;

revoke insert, update, delete on public.review_images from anon, authenticated;

-- Visible photos of visible reviews; the author also sees their own (even hidden).
create policy review_images_public_read on public.review_images
  for select using (
    is_visible and exists (select 1 from public.reviews r where r.id = review_id and r.is_visible)
  );
create policy review_images_select_own on public.review_images
  for select using (user_id = auth.uid());

-- Photos belong to the review's author, at most 4 per review. The review row is locked first so
-- two concurrent inserts for the same review can't both see 3 and both succeed.
create function public.check_review_image_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform 1 from reviews where id = new.review_id and user_id = new.user_id for update;
  if not found then
    raise exception 'REVIEW_IMAGE_NOT_AUTHOR' using errcode = 'P0001';
  end if;
  if (select count(*) from review_images where review_id = new.review_id) >= 4 then
    raise exception 'REVIEW_IMAGE_LIMIT' using errcode = 'P0001';
  end if;
  return new;
end
$$;

create trigger trg_review_images_limit before insert on public.review_images
  for each row execute function public.check_review_image_limit();
