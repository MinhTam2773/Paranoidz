-- ============================================================
-- DEV SEED — mock catalog + test customers. Remove before launch.
-- Idempotent: fixed ids + on conflict, safe to re-run.
-- ============================================================

-- ---------- categories ----------
insert into public.categories (id, name, slug, sort_order) values
  ('c0000000-0000-4000-8000-000000000001', 'Tees',        'tees',        1),
  ('c0000000-0000-4000-8000-000000000002', 'Hoodies',     'hoodies',     2),
  ('c0000000-0000-4000-8000-000000000003', 'Bottoms',     'bottoms',     3),
  ('c0000000-0000-4000-8000-000000000004', 'Accessories', 'accessories', 4)
on conflict (slug) do nothing;

-- ---------- products ----------
insert into public.products (id, name, slug, description, care_instructions, category_id) values
  ('d0000000-0000-4000-8000-000000000001', 'Paranoid logo tee',    'paranoid-logo-tee',    'Heavyweight 250gsm cotton tee with chest logo print.',  'Machine wash cold, inside out.', 'c0000000-0000-4000-8000-000000000001'),
  ('d0000000-0000-4000-8000-000000000002', 'Static noise tee',     'static-noise-tee',     'Oversized tee with distressed static back graphic.',    'Machine wash cold, inside out.', 'c0000000-0000-4000-8000-000000000001'),
  ('d0000000-0000-4000-8000-000000000003', 'Night shift boxy tee', 'night-shift-boxy-tee', 'Boxy cropped fit, puff print on the sleeve.',           'Machine wash cold, inside out.', 'c0000000-0000-4000-8000-000000000001'),
  ('d0000000-0000-4000-8000-000000000004', 'Overthink hoodie',     'overthink-hoodie',     '400gsm brushed fleece hoodie, embroidered front.',       'Wash cold, do not tumble dry.',  'c0000000-0000-4000-8000-000000000002'),
  ('d0000000-0000-4000-8000-000000000005', 'Signal zip hoodie',    'signal-zip-hoodie',    'Full-zip hoodie with reflective back print.',           'Wash cold, do not tumble dry.',  'c0000000-0000-4000-8000-000000000002'),
  ('d0000000-0000-4000-8000-000000000006', 'Paranoid cargo pants', 'paranoid-cargo-pants', 'Relaxed cargo pants with six pockets and drawcord hem.', 'Machine wash cold.',             'c0000000-0000-4000-8000-000000000003'),
  ('d0000000-0000-4000-8000-000000000007', 'Wide leg denim',       'wide-leg-denim',       '14oz washed denim, wide straight leg.',                 'Wash inside out, cold.',         'c0000000-0000-4000-8000-000000000003'),
  ('d0000000-0000-4000-8000-000000000008', 'Void track shorts',    'void-track-shorts',    'Nylon track shorts with mesh lining.',                  'Machine wash cold.',             'c0000000-0000-4000-8000-000000000003'),
  ('d0000000-0000-4000-8000-000000000009', 'Eye logo cap',         'eye-logo-cap',         'Six-panel washed cotton cap, embroidered eye logo.',    'Spot clean only.',               'c0000000-0000-4000-8000-000000000004'),
  ('d0000000-0000-4000-8000-000000000010', 'Paranoidz tote bag',   'paranoidz-tote-bag',   'Heavy canvas tote with inner pocket.',                  'Spot clean only.',               'c0000000-0000-4000-8000-000000000004')
on conflict (slug) do nothing;

-- ---------- variants: colours x sizes ----------
-- Stock is a deterministic pseudo-random 0..14, so some variants are sold out
-- (0) and some are low stock (<= 3) for the storefront and dashboard states.
insert into public.product_variants (product_id, color, size, price, original_price, stock, sku)
select p.id, c.color, s.size, v.price, v.original_price,
       abs(hashtext(v.slug || c.color || s.size)) % 15,
       'PZ-' || v.code || '-' || upper(replace(c.color, ' ', '')) || '-' || s.size
  from (values
    ('paranoid-logo-tee',    'PLT', array['Black','White'],  array['S','M','L','XL'], 269000, null::numeric),
    ('static-noise-tee',     'SNT', array['Black','Grey'],   array['S','M','L','XL'], 289000, 349000),
    ('night-shift-boxy-tee', 'NSB', array['White'],          array['S','M','L'],      299000, null),
    ('overthink-hoodie',     'OTH', array['Black','Cream'],  array['M','L','XL'],     599000, null),
    ('signal-zip-hoodie',    'SZH', array['Charcoal'],       array['M','L','XL'],     649000, 749000),
    ('paranoid-cargo-pants', 'PCP', array['Black','Olive'],  array['S','M','L','XL'], 549000, null),
    ('wide-leg-denim',       'WLD', array['Washed blue'],    array['S','M','L','XL'], 579000, null),
    ('void-track-shorts',    'VTS', array['Black'],          array['S','M','L'],      329000, null),
    ('eye-logo-cap',         'ELC', array['Black','Beige'],  array['FREE'],           249000, null),
    ('paranoidz-tote-bag',   'PTB', array['Cream'],          array['FREE'],           199000, null)
  ) as v(slug, code, colors, sizes, price, original_price)
  join public.products p on p.slug = v.slug
  cross join lateral unnest(v.colors) as c(color)
  cross join lateral unnest(v.sizes)  as s(size)
on conflict (product_id, color, size) do nothing;

-- ---------- images ----------
-- Paths only: no Storage bucket or files exist yet. One general image per
-- product (color NULL) plus one primary per colourway.
insert into public.product_images (product_id, color, storage_path, sort_order, is_primary)
select p.id, null, 'products/' || p.slug || '/main.jpg', 0, false
  from public.products p
 where p.id::text like 'd0000000-%'
   and not exists (select 1 from public.product_images i where i.product_id = p.id and i.color is null);

insert into public.product_images (product_id, color, storage_path, sort_order, is_primary)
select distinct v.product_id, v.color,
       'products/' || p.slug || '/' || lower(replace(v.color, ' ', '-')) || '-1.jpg', 1, true
  from public.product_variants v
  join public.products p on p.id = v.product_id
 where p.id::text like 'd0000000-%'
   and not exists (select 1 from public.product_images i where i.product_id = v.product_id and i.color = v.color);

-- ---------- test customers (email/password, pre-confirmed) ----------
-- Login: customer1..3@paranoidz.test / pz-dev-seed-2026 (dev only, no admin rights).
-- Inserted directly into auth.*; GoTrue rejects NULL token columns, hence ''.
-- on_auth_user_created creates the matching profiles row.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       extensions.crypt('pz-dev-seed-2026', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.full_name),
       now(), now(), '', '', '', ''
  from (values
    ('e0000000-0000-4000-8000-000000000001'::uuid, 'customer1@paranoidz.test', 'Nguyễn Văn An'),
    ('e0000000-0000-4000-8000-000000000002'::uuid, 'customer2@paranoidz.test', 'Trần Thị Bình'),
    ('e0000000-0000-4000-8000-000000000003'::uuid, 'customer3@paranoidz.test', 'Lê Minh Châu')
  ) as u(id, email, full_name)
on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
  from auth.users u
 where u.id::text like 'e0000000-%'
on conflict do nothing;

-- phone is required before first order (place_order: PHONE_REQUIRED)
update public.profiles p
   set phone = v.phone
  from (values
    ('e0000000-0000-4000-8000-000000000001'::uuid, '0901000001'),
    ('e0000000-0000-4000-8000-000000000002'::uuid, '0901000002'),
    ('e0000000-0000-4000-8000-000000000003'::uuid, '0901000003')
  ) as v(id, phone)
 where p.id = v.id and p.phone is null;

insert into public.addresses (id, user_id, name, phone, address, ward, district, city, label, is_default) values
  ('a0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'Nguyễn Văn An', '0901000001', '12 Lý Tự Trọng', 'Bến Nghé',   'Quận 1',    'TP. Hồ Chí Minh', 'Nhà',     true),
  ('a0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000002', 'Trần Thị Bình', '0901000002', '45 Hàng Bài',    'Hàng Bài',   'Hoàn Kiếm', 'Hà Nội',          'Nhà',     true),
  ('a0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000003', 'Lê Minh Châu',  '0901000003', '88 Bạch Đằng',   'Hải Châu 1', 'Hải Châu',  'Đà Nẵng',         'Công ty', true)
on conflict (id) do nothing;
