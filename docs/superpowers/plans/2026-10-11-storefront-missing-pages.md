# Storefront Missing Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/feedback`, `/branding`, `/policy` and upgrade `/collections/[slug]` (Outlet 2026 / New collection) to the Stitch Outlet layout.

**Architecture:** Server pages with ISR (`revalidate = 60`) fetch whole lists through the public Supabase client (RLS filters); small client components do tabs / sort / pagination in memory (spec approach A). Branding and Policy are static pages with PLACEHOLDER copy. One migration adds `collections.description`.

**Tech Stack:** Next.js 16 (async params), React 19, Tailwind v4 tokens from `apps/storefront/src/app/globals.css`, Supabase (`@paranoidz/db`), pnpm workspace.

**Spec:** `docs/superpowers/specs/2026-10-11-storefront-missing-pages-design.md`

**Testing note:** the repo has no test runner, and CLAUDE.md §6.5 forbids new dependencies without need. Each task is verified the project's way: `pnpm --filter <app> build` + `pnpm --filter <app> lint`, then the browser preview at 375px and 1280px (DOM checks via `read_page` / `javascript_tool`, screenshot as proof). Server for verification: `.claude/launch.json` dev config for the storefront.

---

## File map

| File | Task | Responsibility |
| --- | --- | --- |
| `apps/storefront/src/components/product/ReviewSection.tsx` | 1 | export existing `Stars` |
| `apps/storefront/src/app/feedback/page.tsx` | 1 | fetch visible reviews, header stats, empty state |
| `apps/storefront/src/components/feedback/FeedbackList.tsx` | 1 | tabs + review cards + load more |
| `apps/storefront/src/components/layout/icons.tsx` | 2 | + `BadgeCheckIcon`, `GemIcon`, `SparklesIcon` |
| `apps/storefront/src/app/branding/page.tsx` | 2 | static brand story |
| `apps/storefront/src/app/policy/page.tsx` | 3 | static policy sections with anchors |
| `supabase/migrations/20261011000001_collection_description.sql` | 4 | `collections.description` |
| `packages/db/src/types.ts` | 4 | regenerated types |
| `apps/admin/src/app/(shell)/collections/actions.ts` | 4 | save description |
| `apps/admin/src/components/collections/CollectionForm.tsx` | 4 | "Mô tả" textarea |
| `apps/admin/src/app/(shell)/collections/[id]/page.tsx`, `new/page.tsx` | 4 | pass description |
| `apps/storefront/src/components/product/ProductGrid.tsx` | 5 | sort select + 12/page pagination |
| `apps/storefront/src/app/collections/[slug]/page.tsx` | 5 | description + `ProductGrid` |
| `TODO.md` | 6 | Done entries, debt, nav-404 note |

---

### Task 1: `/feedback` — Đánh giá khách hàng

**Files:**
- Modify: `apps/storefront/src/components/product/ReviewSection.tsx:95` (`function Stars` → `export function Stars`)
- Create: `apps/storefront/src/components/feedback/FeedbackList.tsx`
- Create: `apps/storefront/src/app/feedback/page.tsx`

- [ ] **Step 1: Export `Stars`**

In `ReviewSection.tsx` change `function Stars({ rating }: { rating: number }) {` to `export function Stars({ rating }: { rating: number }) {`. Nothing else.

- [ ] **Step 2: Create `FeedbackList.tsx`**

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { secondaryClass } from "@/components/auth/styles";
import { Stars } from "@/components/product/ReviewSection";
import { placedOn } from "@/lib/order-status";

export type FeedbackReview = {
  id: string;
  rating: number;
  content: string;
  authorName: string;
  createdAt: string;
  product: { name: string; slug: string } | null;
  photoUrl: string | null;
};

const PAGE = 9;
const TABS = [
  { id: "recent", label: "Mới nhất" },
  { id: "top", label: "Đánh giá cao" },
  { id: "photos", label: "Có hình ảnh" },
] as const;
type Tab = (typeof TABS)[number]["id"];

// Reviews arrive newest first; the sort is stable, so "top" stays newest first within a rating.
function pick(reviews: FeedbackReview[], tab: Tab) {
  if (tab === "top") return reviews.toSorted((a, b) => b.rating - a.rating);
  if (tab === "photos") return reviews.filter((r) => r.photoUrl);
  return reviews;
}

// Stitch "Customer Feedback": tab pills (DESIGN.md §4 tab switcher), 3-column cards, load more.
// Every review is from a customer with a delivered order (reviews RLS), hence "Đã mua hàng".
export function FeedbackList({ reviews }: { reviews: FeedbackReview[] }) {
  const [tab, setTab] = useState<Tab>("recent");
  const [shown, setShown] = useState(PAGE);
  const list = pick(reviews, tab);

  return (
    <section>
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={t.id === tab}
            onClick={() => {
              setTab(t.id);
              setShown(PAGE);
            }}
            className={`h-11 rounded-sm px-6 text-nav font-bold uppercase transition-colors duration-200 ${
              t.id === tab ? "bg-text-primary text-text-on-dark" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {list.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.slice(0, shown).map((r) => (
            <li key={r.id} className="flex flex-col gap-3 rounded-sm border border-border p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <p className="text-product-name font-semibold uppercase">{r.authorName}</p>
                  <p className="text-caption font-semibold uppercase text-text-secondary">
                    <span aria-hidden className="text-success">✓</span> Đã mua hàng
                  </p>
                </div>
                <Stars rating={r.rating} />
              </div>
              {r.photoUrl && (
                <div className="relative aspect-4/3 overflow-hidden rounded-sm bg-bg-secondary">
                  <Image
                    src={r.photoUrl}
                    alt={`Ảnh đánh giá của ${r.authorName}`}
                    fill
                    sizes="(min-width: 1280px) 400px, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                </div>
              )}
              <p className="whitespace-pre-line text-body">{r.content}</p>
              <div className="mt-auto flex flex-wrap justify-between gap-2 border-t border-border pt-3 text-caption uppercase text-text-muted">
                <span>{placedOn.format(new Date(r.createdAt))}</span>
                {r.product && (
                  <Link href={`/products/${r.product.slug}`} className="text-text-secondary hover:text-text-primary">
                    {r.product.name}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-text-secondary">Chưa có đánh giá kèm hình ảnh.</p>
      )}

      {shown < list.length && (
        <button type="button" onClick={() => setShown((n) => n + PAGE)} className={`${secondaryClass} mx-auto mt-8 max-w-xs`}>
          Xem thêm đánh giá
        </button>
      )}
    </section>
  );
}
```

(The empty-list message only shows on the "Có hình ảnh" tab: the page doesn't render `FeedbackList` when there are no reviews at all, and the other tabs show every review.)

- [ ] **Step 3: Create `app/feedback/page.tsx`**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { createPublicClient } from "@paranoidz/db/public";
import { FeedbackList, type FeedbackReview } from "@/components/feedback/FeedbackList";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Stars } from "@/components/product/ReviewSection";

export const metadata: Metadata = { title: "Đánh giá khách hàng | Paranoidz" };

// Every visible review in the store (RLS: visible reviews and photos only). ISR like the catalog;
// the whole list is fetched and tabbed client-side (spec 2026-10-11, approach A).
export const revalidate = 60;

async function getReviews(): Promise<FeedbackReview[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("id, rating, content, author_name, created_at, products(name, slug), review_images(storage_path, sort_order)")
    .order("created_at", { ascending: false })
    .order("sort_order", { referencedTable: "review_images" });
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    rating: r.rating,
    content: r.content,
    authorName: r.author_name,
    createdAt: r.created_at,
    // null when RLS hides the product (inactive): the card just has no product link
    product: r.products,
    photoUrl: r.review_images[0]
      ? supabase.storage.from("review-images").getPublicUrl(r.review_images[0].storage_path).data.publicUrl
      : null,
  }));
}

export default async function FeedbackPage() {
  const reviews = await getReviews();
  const average = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-6">
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Đánh giá khách hàng" }]} />
      <h1 className="mb-6 text-h2 uppercase">Đánh giá khách hàng</h1>
      {reviews.length ? (
        <>
          <div className="mb-8 grid grid-cols-2 divide-x divide-border border-y border-border py-6 text-center">
            <div className="flex flex-col items-center gap-2 px-2">
              <Stars rating={Math.round(average)} />
              <p className="text-h3 uppercase">{average.toFixed(1).replace(".", ",")}/5 điểm trung bình</p>
            </div>
            <div className="flex flex-col items-center justify-center gap-1 px-2">
              <p className="text-h3 uppercase">{reviews.length} đánh giá</p>
              <p className="text-caption uppercase text-text-secondary">Từ khách đã mua hàng</p>
            </div>
          </div>
          <FeedbackList reviews={reviews} />
        </>
      ) : (
        <p className="text-text-secondary">
          Chưa có đánh giá nào.{" "}
          <Link href="/products" className="text-text-primary underline underline-offset-4 hover:text-accent">
            Xem sản phẩm
          </Link>
        </p>
      )}
    </div>
  );
}
```

If the generated types make `r.products` an array instead of an object (one-to-many inference), use `r.products?.[0] ?? null` — check the type error in Step 4.

- [ ] **Step 4: Build + lint**

Run: `pnpm --filter storefront lint` then `pnpm --filter storefront build`
Expected: both pass; route list shows `○ /feedback` (static, revalidate 1m).

- [ ] **Step 5: Browser check**

`preview_start` the storefront dev config, open `/feedback` at 1280px and 375px.
Expected (DB has 0 reviews): breadcrumb TRANG CHỦ / ĐÁNH GIÁ KHÁCH HÀNG, H1, "Chưa có đánh giá nào. Xem sản phẩm"; nav item "Đánh giá khách hàng" active; no console errors.
Populated state needs reviews: ask the owner before adding temporary test rows (a review needs a delivered order, so it is a multi-table insert through the CLI).

- [ ] **Step 6: Commit**

```bash
git add apps/storefront/src/components/product/ReviewSection.tsx apps/storefront/src/components/feedback/FeedbackList.tsx apps/storefront/src/app/feedback/page.tsx
git commit -m "feat: add customer feedback page with all visible reviews"
```

---

### Task 2: `/branding` — Thương hiệu

**Files:**
- Modify: `apps/storefront/src/components/layout/icons.tsx` (after `ChevronDownIcon`)
- Create: `apps/storefront/src/app/branding/page.tsx`

- [ ] **Step 1: Add three icons to `icons.tsx`** (Lucide shapes, same 24px stroke wrapper)

```tsx
export const BadgeCheckIcon = (p: P) => (
  <Icon {...p}><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" /><path d="m9 12 2 2 4-4" /></Icon>
);
export const GemIcon = (p: P) => (
  <Icon {...p}><path d="M6 3h12l4 6-10 13L2 9Z" /><path d="M11 3 8 9l4 13 4-13-3-6" /><path d="M2 9h20" /></Icon>
);
export const SparklesIcon = (p: P) => (
  <Icon {...p}><path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0l1.58 6.14a2 2 0 0 0 1.44 1.44l6.14 1.58a.5.5 0 0 1 0 .96l-6.14 1.58a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0Z" /></Icon>
);
```

- [ ] **Step 2: Create `app/branding/page.tsx`**

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { BadgeCheckIcon, GemIcon, SparklesIcon } from "@/components/layout/icons";

export const metadata: Metadata = { title: "Thương hiệu | Paranoidz" };

// Brand story (Stitch "PARANOIDZ - Branding Page", spec 2026-10-11 §2). The hero is a dark block,
// not a photo: DESIGN.md keeps the hero banner for the homepage.
// PLACEHOLDER — copy translated from the Stitch mock-up, grey photo slots. The client supplies the real
// text and photos; a photo goes in as <Image fill className="object-cover" /> inside the same slot.
const PHILOSOPHY = [
  "Sinh ra giữa những khu phố bê tông của Việt Nam, PARANOIDZ là lời đáp trả trước sự ồn ào của thời trang nhanh. Chúng tôi tin rằng sự nổi loạn thật sự không cần phải hét lên — nó nằm ở độ chính xác của từng đường cắt, sức nặng của chất vải và hình dáng của một chiếc bóng.",
  "Gốc rễ từ văn hoá underground Sài Gòn có mặt trong mọi bộ sưu tập. Chúng tôi kết hợp chất liệu kỹ thuật với tinh thần streetwear thô mộc, tạo nên lớp áo giáp cho người trẻ thành thị — những người đi qua hỗn loạn bằng sự điềm tĩnh.",
  "Chất lượng là điều chúng tôi ám ảnh. Mỗi đường may là một cam kết về độ bền, để sản phẩm theo bạn qua mọi va chạm của đường phố mà vẫn giữ nguyên phom dáng. Bản sắc là một tấm canvas — và chúng tôi mang đến những gam màu đầu tiên.",
];

const VALUES = [
  { Icon: BadgeCheckIcon, title: "Chân thật", text: "Trung thành với đường phố và văn hoá underground đã sinh ra chúng tôi. Không thoả hiệp." },
  { Icon: GemIcon, title: "Chất lượng", text: "Chất liệu cao cấp, đường may tỉ mỉ. Bền bỉ trước nhịp sống đô thị." },
  { Icon: SparklesIcon, title: "Đổi mới", text: "Không ngừng mở rộng giới hạn của streetwear với phom dáng mới và thiết kế linh hoạt." },
];

function PhotoSlot({ className }: { className: string }) {
  return <div aria-hidden="true" className={`rounded-sm bg-bg-tertiary ${className}`} />;
}

// Section title with the vertical accent bar (DESIGN.md §4), as on the homepage.
function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-6 border-l-4 border-accent pl-3 text-h2 uppercase">{children}</h2>;
}

export default function BrandingPage() {
  return (
    <>
      <div className="mx-auto w-full max-w-7xl px-4 lg:px-6">
        <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Thương hiệu" }]} />
      </div>

      <section className="bg-bg-dark px-4 py-24 text-center text-text-on-dark">
        <h1 className="text-h1-mobile uppercase lg:text-h1">Câu chuyện Paranoidz</h1>
        <p className="mt-4 text-body italic text-text-on-dark/80">Định nghĩa lại bản sắc đường phố bằng thiết kế tối giản.</p>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-16 lg:grid-cols-2 lg:gap-12 lg:px-6">
        <div>
          <SectionTitle>Triết lý</SectionTitle>
          <div className="flex flex-col gap-4 text-body text-text-secondary">
            {PHILOSOPHY.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <PhotoSlot className="mt-8 aspect-3/4" />
          <PhotoSlot className="aspect-3/4" />
        </div>
      </section>

      <section className="bg-bg-secondary px-4 py-16">
        <ul className="mx-auto grid max-w-7xl gap-10 sm:grid-cols-3">
          {VALUES.map(({ Icon, title, text }) => (
            <li key={title} className="flex flex-col items-center gap-3 text-center">
              <span className="flex size-12 items-center justify-center rounded-sm border border-border bg-bg-primary">
                <Icon />
              </span>
              <h3 className="text-h3 uppercase">{title}</h3>
              <p className="max-w-xs text-caption text-text-secondary">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-16 lg:px-6">
        <SectionTitle>Đời sống Paranoidz</SectionTitle>
        {/* lg: large 2×2 | two stacked squares | tall 1×2. Mobile: large on top, then square + tall + square. */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <PhotoSlot className="col-span-2 aspect-square lg:row-span-2 lg:aspect-auto" />
          <PhotoSlot className="aspect-square" />
          <PhotoSlot className="row-span-2" />
          <PhotoSlot className="aspect-square" />
        </div>
      </section>
    </>
  );
}
```

- [ ] **Step 3: Build + lint**

Run: `pnpm --filter storefront lint` then `pnpm --filter storefront build`
Expected: pass; `○ /branding` static.

- [ ] **Step 4: Browser check** at 1280px and 375px

Expected: breadcrumb, dark hero with H1, philosophy text + 2 grey slots (side by side ≥1024px, below text on mobile), values row of 3 (stacked on mobile), photo grid as described; no horizontal scroll at 375px (`document.documentElement.scrollWidth === 375`); nav "Thương hiệu" active.

- [ ] **Step 5: Commit**

```bash
git add apps/storefront/src/components/layout/icons.tsx apps/storefront/src/app/branding/page.tsx
git commit -m "feat: add branding page with placeholder copy and photo slots"
```

---

### Task 3: `/policy` — Chính sách

**Files:**
- Create: `apps/storefront/src/app/policy/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { HOTLINE } from "@/lib/site";

export const metadata: Metadata = { title: "Chính sách | Paranoidz" };

const link = "text-text-primary underline underline-offset-4 hover:text-accent";

// Shipping / returns / privacy; the ids match the footer's POLICY_LINKS anchors (lib/site.ts).
// PLACEHOLDER — client to approve. Drafted from what the shop actually does (COD only, SPX rate per
// province, the checkout fields); the return terms in [brackets] are not decided yet.
const SECTIONS: { id: string; title: string; body: ReactNode[] }[] = [
  {
    id: "shipping",
    title: "Chính sách giao hàng",
    body: [
      "Paranoidz giao hàng toàn quốc qua đơn vị vận chuyển SPX Express.",
      "Thanh toán khi nhận hàng (COD): bạn chỉ trả tiền khi nhận được hàng. Cửa hàng chưa hỗ trợ thanh toán trực tuyến.",
      "Phí giao hàng tính theo bảng giá SPX cho từng tỉnh/thành và hiển thị ở bước thanh toán, trước khi bạn đặt hàng.",
      <>
        Sau khi đặt hàng, bạn có thể theo dõi đơn tại trang{" "}
        <Link href="/order-lookup" className={link}>Tra cứu đơn hàng</Link> bằng mã đơn (PZ-…) và số điện thoại đặt hàng.
      </>,
    ],
  },
  {
    id: "returns",
    title: "Chính sách đổi trả",
    body: [
      "Bạn có thể yêu cầu đổi hàng trong vòng [số ngày] ngày kể từ khi nhận hàng.",
      "Sản phẩm đổi cần [điều kiện, ví dụ: còn nguyên tem mác, chưa qua sử dụng, chưa giặt].",
      "Phí vận chuyển khi đổi hàng do [cửa hàng / khách hàng] chi trả.",
      `Để yêu cầu đổi hàng, gọi hotline ${HOTLINE} và cung cấp mã đơn hàng.`,
    ],
  },
  {
    id: "privacy",
    title: "Chính sách bảo mật",
    body: [
      "Khi đặt hàng, chúng tôi thu thập họ tên, số điện thoại, địa chỉ giao hàng và email (nếu bạn cung cấp). Khi bạn tạo tài khoản, chúng tôi lưu thêm email đăng nhập và các địa chỉ bạn đã lưu.",
      "Thông tin này chỉ dùng để xử lý, giao đơn hàng và liên hệ với bạn về đơn hàng. Chúng tôi không bán thông tin của bạn và chỉ chia sẻ với đơn vị vận chuyển để giao hàng.",
      "Trang web dùng cookie và bộ nhớ trình duyệt để giữ đăng nhập, giỏ hàng và danh sách yêu thích.",
      `Để xem, sửa hoặc xoá thông tin của bạn, gọi hotline ${HOTLINE}.`,
    ],
  },
];

export default function PolicyPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-6">
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Chính sách" }]} />
      <h1 className="mb-8 text-h2 uppercase">Chính sách</h1>
      <div className="flex max-w-3xl flex-col gap-12">
        {SECTIONS.map(({ id, title, body }) => (
          // scroll-mt clears the sticky header (64px mobile, 112px with the desktop nav row)
          <section key={id} id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 lg:scroll-mt-32">
            <h2 id={`${id}-title`} className="mb-4 border-l-4 border-accent pl-3 text-h3 uppercase">{title}</h2>
            <div className="flex flex-col gap-3 text-body text-text-secondary">
              {body.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build + lint** — `pnpm --filter storefront lint`, `pnpm --filter storefront build`. Expected: pass; `○ /policy`.

- [ ] **Step 3: Browser check**

At 1280px and 375px: open `/`, click each footer policy link; expected URL `/policy#shipping|#returns|#privacy` and that section's heading visible below the sticky header (`getBoundingClientRect().top` ≥ header height). "Tra cứu đơn hàng" link works. Nav "Chính sách" active.

- [ ] **Step 4: Commit**

```bash
git add apps/storefront/src/app/policy/page.tsx
git commit -m "feat: add policy page with shipping, returns and privacy drafts"
```

---

### Task 4: `collections.description` — migration, types, admin field

**Files:**
- Create: `supabase/migrations/20261011000001_collection_description.sql`
- Modify: `packages/db/src/types.ts` (generated)
- Modify: `apps/admin/src/app/(shell)/collections/actions.ts`
- Modify: `apps/admin/src/components/collections/CollectionForm.tsx`
- Modify: `apps/admin/src/app/(shell)/collections/[id]/page.tsx`, `apps/admin/src/app/(shell)/collections/new/page.tsx`

- [ ] **Step 1: Migration**

```sql
-- Optional collection subtitle, shown under the title on the storefront collection page
-- (Stitch "Outlet 2026"; spec 2026-10-11 §4). Edited in the admin collection form.
alter table public.collections
  add column description text check (char_length(description) <= 300);
```

No RLS change: the existing `collections` select policy covers the new column, admin writes use the service role.

- [ ] **Step 2: Apply + regenerate types** (repo root; project is linked)

Run: `supabase db push` → expected "Applying migration 20261011000001_collection_description.sql… Finished".
Run: `pnpm --filter @paranoidz/db gen:types` → `git diff packages/db/src/types.ts` shows `description: string | null` in `collections` Row/Insert/Update.

- [ ] **Step 3: Server action** — in `actions.ts`:

```ts
export type CollectionInput = { id?: string; name: string; slug: string; description: string; isActive: boolean; productIds: string[] };
```

after the slug checks:

```ts
  const description = input.description.trim();
  if (description.length > 300) errors.description = "Tối đa 300 ký tự.";
```

insert: `.insert({ name, slug, description: description || null, is_active: input.isActive, sort_order: … })`
update: `.update({ name, description: description || null, is_active: input.isActive })`

- [ ] **Step 4: Form** — in `CollectionForm.tsx`:
  - `initial` type gains `description: string`; add `const [description, setDescription] = useState(initial.description);`
  - submit passes `description`
  - after the slug field `<div>`, before the active checkbox:

```tsx
          <div className="flex flex-col gap-2 md:col-span-2">
            <label htmlFor="description" className="text-label uppercase">Mô tả</label>
            <textarea
              id="description" value={description} rows={2} maxLength={300} aria-invalid={!!errors.description} aria-describedby={errors.description ? "description-error" : undefined}
              onChange={(e) => setDescription(e.target.value)}
              className={`${input} h-auto py-2 ${errors.description ? "border-accent" : "border-border"}`}
            />
            <p className="text-stat-label text-text-secondary">Hiện dưới tên bộ sưu tập trên cửa hàng. Để trống nếu không cần.</p>
            {err("description")}
          </div>
```

- [ ] **Step 5: Pages** — `[id]/page.tsx`: select `"id, name, slug, description, is_active, collection_items(product_id, sort_order)"` and pass `description: collection.description ?? ""`. `new/page.tsx`: `initial={{ name: "", slug: "", description: "", isActive: true, productIds: [] }}`.

- [ ] **Step 6: Build + lint both apps** — `pnpm --filter admin lint`, `pnpm --filter admin build`, `pnpm --filter storefront build`. Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261011000001_collection_description.sql packages/db/src/types.ts apps/admin/src
git commit -m "feat: add collection description field in the admin"
```

---

### Task 5: Collection page — description, sort, pagination

**Files:**
- Create: `apps/storefront/src/components/product/ProductGrid.tsx`
- Modify: `apps/storefront/src/app/collections/[slug]/page.tsx`

- [ ] **Step 1: Create `ProductGrid.tsx`**

```tsx
"use client";

import { useRef, useState, type ReactNode } from "react";
import { ChevronDownIcon } from "@/components/layout/icons";
import { ProductCard, type ProductCardData } from "./ProductCard";

const PER_PAGE = 12;

const discount = (p: ProductCardData) =>
  p.originalPrice !== null && p.originalPrice > p.price ? (p.originalPrice - p.price) / p.originalPrice : -1;

const SORTS = {
  recent: { label: "Mới nhất", compare: null },
  "price-asc": { label: "Giá thấp → cao", compare: (a: ProductCardData, b: ProductCardData) => a.price - b.price },
  "price-desc": { label: "Giá cao → thấp", compare: (a: ProductCardData, b: ProductCardData) => b.price - a.price },
  discount: { label: "Giảm nhiều nhất", compare: (a: ProductCardData, b: ProductCardData) => discount(b) - discount(a) },
};
type Sort = keyof typeof SORTS;

// 1 … 4 5 6 … 10: first, last and the current page's neighbours.
function pageList(current: number, total: number) {
  const keep = new Set([1, total, current - 1, current, current + 1]);
  const out: (number | "gap")[] = [];
  let prev = 0;
  for (let p = 1; p <= total; p++) {
    if (!keep.has(p)) continue;
    if (p - prev > 1) out.push("gap");
    out.push(p);
    prev = p;
  }
  return out;
}

const pageButton = "flex size-11 items-center justify-center rounded-sm border text-button transition-colors duration-200";

// Stitch "Outlet 2026" toolbar + grid (spec 2026-10-11 §4, approach A): the page passes every card
// (ISR), sorting and paging happen here. "Mới nhất" keeps the order the server sent. `children` is the
// page heading, laid out beside the sort select.
export function ProductGrid({ cards, children }: { cards: ProductCardData[]; children: ReactNode }) {
  const [sort, setSort] = useState<Sort>("recent");
  const [page, setPage] = useState(1);
  const top = useRef<HTMLDivElement>(null);

  const compare = SORTS[sort].compare;
  const sorted = compare ? cards.toSorted(compare) : cards;
  const pages = Math.ceil(sorted.length / PER_PAGE);
  const visible = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function goTo(p: number) {
    setPage(p);
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div ref={top} className="scroll-mt-20 lg:scroll-mt-32">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>{children}</div>
        {cards.length > 1 && (
          <label className="flex shrink-0 items-center gap-3 text-nav uppercase text-text-secondary">
            Sắp xếp
            <span className="relative">
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as Sort);
                  setPage(1);
                }}
                className="h-11 appearance-none rounded-sm border border-border bg-bg-primary pl-3 pr-10 text-base normal-case text-text-primary focus:border-text-primary focus:shadow-[0_0_0_2px_var(--color-accent-soft)] focus:outline-none lg:text-product-name"
              >
                {Object.entries(SORTS).map(([value, s]) => (
                  <option key={value} value={value}>{s.label}</option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-primary" />
            </span>
          </label>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {visible.map((card, i) => (
          <ProductCard key={card.slug} product={card} eager={page === 1 && i < 3} />
        ))}
      </div>

      {pages > 1 && (
        <nav aria-label="Phân trang" className="mt-10 flex justify-center gap-2">
          <button type="button" aria-label="Trang trước" disabled={page === 1} onClick={() => goTo(page - 1)} className={`${pageButton} border-border disabled:opacity-30`}>
            <ChevronDownIcon className="size-4 rotate-90" />
          </button>
          {pageList(page, pages).map((p, i) =>
            p === "gap" ? (
              <span key={`gap-${i}`} aria-hidden className="flex size-11 items-center justify-center text-text-muted">…</span>
            ) : (
              <button
                key={p}
                type="button"
                aria-current={p === page ? "page" : undefined}
                onClick={() => goTo(p)}
                className={`${pageButton} ${p === page ? "border-text-primary bg-text-primary text-text-on-dark" : "border-border hover:border-text-primary"}`}
              >
                {p}
              </button>
            ),
          )}
          <button type="button" aria-label="Trang sau" disabled={page === pages} onClick={() => goTo(page + 1)} className={`${pageButton} border-border disabled:opacity-30`}>
            <ChevronDownIcon className="size-4 -rotate-90" />
          </button>
        </nav>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update the collection page**

`getCollection`: select `"name, description, collection_items(product_id, sort_order)"`; both returns carry `description: collection.description`.

Imports: drop nothing used elsewhere; add `import { ProductGrid } from "@/components/product/ProductGrid";` and remove the now-unused `ProductCard` import.

Render:

```tsx
  const heading = (
    <>
      <h1 className="text-h2 uppercase">{collection.name}</h1>
      {collection.description && <p className="mt-2 max-w-xl text-body text-text-secondary">{collection.description}</p>}
    </>
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-6">
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: collection.name }]} />
      {collection.cards.length ? (
        <ProductGrid cards={collection.cards}>{heading}</ProductGrid>
      ) : (
        <>
          <div className="mb-6">{heading}</div>
          <p className="text-text-secondary">
            Bộ sưu tập này chưa có sản phẩm.{" "}
            <Link href="/products" className="text-text-primary underline underline-offset-4 hover:text-accent">Xem tất cả sản phẩm</Link>
          </p>
        </>
      )}
    </div>
  );
```

- [ ] **Step 3: Build + lint** — `pnpm --filter storefront lint`, `pnpm --filter storefront build`. Expected: pass.

- [ ] **Step 4: Browser check** — needs a collection. Ask the owner: create `outlet-2026` (with description + >12 products if the catalog has them; it has ~10, so pagination can only be checked with a temporary `PER_PAGE` edit that is reverted before commit) in the admin, or let me create it via the admin UI. Check at 1280px/375px: description under H1, sort reorders (price asc: first card cheapest), "Giảm nhiều nhất" puts the largest badge first, page buttons only when > 12, no horizontal scroll.

- [ ] **Step 5: Commit**

```bash
git add apps/storefront/src/components/product/ProductGrid.tsx "apps/storefront/src/app/collections/[slug]/page.tsx"
git commit -m "feat: add sort, pagination and description to collection pages"
```

---

### Task 6: TODO.md

- [ ] **Step 1:** In `TODO.md` → **Done**, add one entry per page (feedback, branding, policy, collection upgrade) with date 2026-10-11, files and what was verified — same style as existing entries.
- [ ] **Step 2:** In **Known gaps — carried debt**: replace the "Nav routes 404 until built" line with: OUTLET 2026 / NEW COLLECTION 404 until the owner creates `outlet-2026` / `new-collection` in the admin. Add: Branding + Policy copy/photos are PLACEHOLDER (client to supply; return terms in brackets); feedback/collection pages fetch whole lists (fine to a few hundred rows, then paged queries); collection sort/page state not in the URL (back button resets); feedback populated state verified only if test data was added.
- [ ] **Step 3:** Commit `chore: record storefront content pages in TODO`.

---

## Self-review

- Spec coverage: §1 → Task 1, §2 → Task 2, §3 → Task 3, §4 → Tasks 4–5, Verification → each task's build/browser steps, Known limits → Task 6. Red-bar rule: Branding + Policy section H2s carry it; page H1s don't.
- Names: `FeedbackReview`, `Stars`, `ProductGrid({ cards, children })`, `CollectionInput.description` used consistently.
