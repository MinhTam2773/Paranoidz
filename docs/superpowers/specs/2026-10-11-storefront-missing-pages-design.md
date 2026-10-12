# Storefront missing pages — design

Date: 2026-10-11 · Status: approved in chat, pending spec review

The nav (`apps/storefront/src/lib/site.ts`) links five pages that 404 today:

| Nav item | Route | State before this work |
| --- | --- | --- |
| Outlet 2026 | `/collections/outlet-2026` | Page code exists; no `collections` row (table is empty) |
| New collection | `/collections/new-collection` | Same |
| Đánh giá khách hàng | `/feedback` | Not built |
| Thương hiệu | `/branding` | Not built |
| Chính sách | `/policy` (footer: `#shipping`, `#returns`, `#privacy`) | Not built |

Visual references: Stitch project `16943126164010481608` screens "PARANOIDZ - Outlet 2026",
"PARANOIDZ - Customer Feedback (Annotated)", "PARANOIDZ - Branding Page". No Stitch screen exists
for New collection (reuses the collection page) or Policy.

## Decisions (owner, 2026-10-11)

- Collection page is upgraded to the Outlet design, including a subtitle from a new `collections.description` column.
- Branding ships with Stitch copy translated to Vietnamese, marked PLACEHOLDER, and grey photo slots.
- Policy ships with Vietnamese drafts from known facts, marked PLACEHOLDER; return terms left open.
- Feedback header shows average rating + total review count (no invented "12,500+ customers").
- Sorting / pagination: **approach A** — server fetches the full list under ISR (`revalidate = 60`),
  a small client component sorts and paginates. Chosen over searchParams (would make pages dynamic,
  one DB hit per view) and load-more for collections (Stitch shows numbered pagination).

## Stitch deviations (DESIGN.md wins, per TODO.md 2026-09-26)

- Product grid stays **3 columns** on desktop (DESIGN.md §5), not Stitch's 4.
- **No red accent bar** beside headings (red is not decorative; same call as the account page).
- **No "Join the Underground" newsletter strip** — no newsletter backend; a form would collect nothing.
- Branding hero is a **dark block with the title**, not a photo (DESIGN.md: hero banner is homepage-only;
  revisit when the client supplies photos).
- Feedback cards do not show replies (they stay on the product page). The tabs replace Stitch's
  separate "Sort by" control.

## 1. `/feedback` — Đánh giá khách hàng

- `app/feedback/page.tsx` (server, `revalidate = 60`): breadcrumb TRANG CHỦ / ĐÁNH GIÁ KHÁCH HÀNG, H1.
- Query (public client, RLS returns visible reviews / photos only):
  `reviews(id, rating, content, author_name, created_at, products(name, slug), review_images(storage_path, sort_order))`,
  newest first. Photo URLs from the `review-images` bucket (same as the product page).
  If RLS hides inactive products from the embed, `products` is null → that card shows no product link.
- Header: `Stars` (exported from `components/product/ReviewSection.tsx`) + "4,8/5" (one decimal,
  Vietnamese comma) + "N đánh giá". Computed from the fetched list.
- `components/feedback/FeedbackList.tsx` (client): tabs **Mới nhất** (date desc) / **Đánh giá cao**
  (rating desc, then date desc) / **Có hình ảnh** (only reviews with ≥1 photo, date desc).
  Shows 9, "Xem thêm đánh giá" adds 9; switching tab resets to 9.
- Card: author name, stars, "Đã mua hàng" tag (true for every review — only customers with a
  delivered order can review), content, first photo (if any), date (`dd/MM/yyyy` via the existing `placedOn` formatter in
  `lib/order-status.ts`, as on the product page), product name linking to `/products/[slug]`.
- Grid: 1 column mobile, 2 at ≥640px, 3 at ≥1024px.
- Empty state (0 reviews): "Chưa có đánh giá nào." + link to `/products`. Empty tab ("Có hình ảnh"
  with none): "Chưa có đánh giá kèm hình ảnh."
- Metadata title: "Đánh giá khách hàng | Paranoidz".

## 2. `/branding` — Thương hiệu

- `app/branding/page.tsx`, fully static. Copy lives in the page file under a `// PLACEHOLDER` comment.
- Sections: breadcrumb → dark hero block (`bg-bg-dark`, H1 "CÂU CHUYỆN PARANOIDZ" + subtitle) →
  "Triết lý" (3 paragraphs + 2 grey photo slots) → values row on `bg-bg-secondary`
  (Chân thật / Chất lượng / Đổi mới, each a small outline icon + title + one line) →
  "Đời sống Paranoidz" 4-slot photo grid (1 large + 2 stacked + 1 tall at ≥1024px; stacked on mobile).
- Photo slots: `bg-bg-secondary` blocks with fixed aspect ratios and an `aria-hidden` treatment, so
  real images drop in later via `next/image` without layout change.
- Icons: three inline SVGs defined in the branding page file, same stroke style as
  `components/layout/icons.tsx` (no icon dependency).
- Metadata title: "Thương hiệu | Paranoidz".

## 3. `/policy` — Chính sách

- `app/policy/page.tsx`, static. Breadcrumb, H1 "CHÍNH SÁCH", three `<section>`s with
  `id="shipping" | "returns" | "privacy"` and `scroll-mt` so the sticky header doesn't cover the heading.
- Draft content (Vietnamese, `// PLACEHOLDER — client to approve`):
  - Giao hàng: COD only; delivery via SPX; fee by province per SPX rate, shown at checkout before
    ordering; order lookup at `/order-lookup`.
  - Đổi trả: placeholder paragraph with the open terms explicitly bracketed (number of days,
    item condition, who pays return shipping) — no invented numbers.
  - Bảo mật: data collected at checkout (name, phone, address, optional email) and account data;
    used only to fulfil orders and contact the customer; not sold; contact via hotline to request deletion.
- Metadata title: "Chính sách | Paranoidz".

## 4. Collection page upgrade (Outlet / New collection)

- Migration `supabase/migrations/20261011000001_collection_description.sql`:
  `alter table public.collections add column description text check (char_length(description) <= 300);`
  Regenerate `packages/db` types.
- Admin `CollectionForm`: optional "Mô tả" textarea (max 300), saved by `saveCollection`
  (empty → null). Admin edit page loads it.
- Storefront `app/collections/[slug]/page.tsx`: select `description`; render under the H1 in
  `text-text-secondary` when present.
- `components/product/ProductGrid.tsx` (client): sort select **Mới nhất** (the admin's order — current
  behaviour) / **Giá thấp → cao** / **Giá cao → thấp** / **Giảm nhiều nhất** (by `(original - price) / original`,
  non-sale items last); 12 per page; numbered pagination (prev / numbers with ellipsis / next), shown only
  when > 12. Changing sort returns to page 1; changing page scrolls to the grid top. State is local
  (not in the URL).
- `ProductCard` unchanged. Grid classes unchanged (2 / 2 / 3 columns).
- After merge: owner creates `outlet-2026` and `new-collection` in admin → Bộ sưu tập.

## Verification (each step)

- `pnpm --filter storefront build` (and `pnpm --filter admin build` for step 4) + lint pass.
- Browser preview at 375px and 1280px: page renders, no console errors, footer policy anchors scroll
  to the right section, tabs / sort / pagination behave as specified.
- The DB has 0 reviews and 0 collections. Feedback's populated state and the collection page need data:
  ask the owner before adding temporary test rows to the remote DB.

## Known limits (go to TODO.md debt)

- Approach A fetches every visible review / collection product per ISR rebuild. Fine to a few hundred
  reviews; past that, move Feedback to paged server queries.
- Branding / Policy copy and photos are placeholders until the client supplies them.
