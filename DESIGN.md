# DESIGN.md — Paranoidz Streetwear

> Design system for the Paranoidz storefront (`apps/storefront`).
> Rewritten 2026-10-17 from the live code after the client's redesign (PRs #6, #8, #9, #10, #12, 2026-10-16). Owner's decision, 2026-10-17: **the client's live design wins** over the original BTM-Studios-style spec. This file describes `master` as built; change it in the same commit as any storefront UI change.
> Checked against paranoidz.vn at 1280px and 375px on 2026-10-17. Items marked _(not seen live)_ are read from the code only: prod had no collections, no categories, no reviews and no colour hexes that day.

---

## 1. Visual Theme & Atmosphere

- **Brand identity**: Vietnamese streetwear with edge. Tagline "Back to Basicz". The name carries tension and underground energy; the shopping area stays clean and light.
- **Mood**: Editorial streetwear. A white shopping area framed by black bands (ticker, marquee, manifesto, footer), big uppercase type, red used for actions, sale badges and small markers (section numerals, ✦, ●).
- **References**: the original brief followed btmstudios.com.vn; the client's redesign borrows from hydrashop.vn (marquee, trust row, FAQ, testimonials, footer social rows, sticky buy bar) and chuottrang.vn (low-stock badges).
- **Density**: Medium. Large gaps between homepage sections (56px mobile, 80px desktop). Products breathe.
- **Logo**: the PARANOIDZ wordmark is an **image**, not live text (`components/layout/Logo.tsx`): `public/home/logo-paranoidz-dark.png` on light backgrounds, `logo-paranoidz-light.png` on dark (footer). 32px tall, 36px from `lg`. Favicon: the circular "pdz" logo. A text wordmark in Rajdhani italic remains only in the login modal.

---

## 2. Color Palette & Roles

Tokens live in `apps/storefront/src/app/globals.css` `@theme` as `--color-<name>` (`bg-bg-primary`, `text-text-muted`…). Tailwind's default palette is removed (`--color-*: initial`), so only these exist.

| Token              | Hex         | Role                                              |
| ------------------ | ----------- | ------------------------------------------------- |
| `--bg-primary`     | `#FFFFFF`   | Page background, cards in bordered grids, dialogs |
| `--bg-secondary`   | `#F5F5F5`   | Product image areas, search input, order summary box, icon circles |
| `--bg-tertiary`    | `#EBEBEB`   | Highlighted suggestion row, disabled buttons, summary thumbnails |
| `--bg-dark`        | `#111111`   | Ticker, marquee, manifesto, footer, carousel / collection-card backdrop, quick-add bar, countdown boxes, sold-out badge, carrier icon |
| `--text-primary`   | `#111111`   | Headings, product names, primary content          |
| `--text-secondary` | `#666666`   | Descriptions, metadata, inactive nav              |
| `--text-muted`     | `#999999`   | Placeholders, disabled, old price, inactive home tab |
| `--text-on-dark`   | `#FFFFFF`   | Text on dark surfaces                             |
| `--accent`         | `#FF2D2D`   | Primary buttons, sale badge + sale price, active indicators, section numerals, ticker ● / marquee ✦, active carousel dot, cart badge, required `*`, field errors |
| `--accent-hover`   | `#E01F1F`   | Hover for accent buttons                          |
| `--accent-soft`    | `#FF2D2D10` | Input focus ring                                  |
| `--border`         | `#E0E0E0`   | Dividers, section-header rules, input outlines, `gap-px` grid lines |
| `--border-hover`   | `#CCCCCC`   | Hovered thumbnails, inactive row dots             |
| `--success`        | `#00C853`   | Delivered status, "Đã mua hàng" check             |
| `--warning`        | `#FFD600`   | "Sắp hết hàng" / "Sắp cháy hàng" badges, review stars, rating pill border, low-stock dot, pending status |

### Color rules
- The shopping area (product grids, product page, cart, checkout) is light: white and `#F5F5F5`.
- Dark appears as **full-width bands** that frame the page (ticker, carousel, marquee, manifesto, footer) and as small solid elements (badges, quick-add bar, countdown digits). Never behind a product grid.
- Opacity modifiers on tokens are in use: `bg-bg-dark/50 /60 /70 /90`, `bg-bg-primary/90 /95`, `text-text-on-dark/60 /70 /80`, `border-text-on-dark/10 /30`.
- Accent red: actions, sale signals, "you are here" indicators and the small markers listed above. No large red areas.
- Product photos sit on `--bg-secondary`. No coloured or gradient backgrounds behind product photos.

---

## 3. Typography Rules

Fonts load through `next/font` in `app/layout.tsx`: Inter 400–800 (`latin` + `vietnamese`) as `font-sans`, Rajdhani 700 (`latin` only) as `font-logo`. Type tokens are `--text-<name>` in `@theme` (`text-h1`, `text-nav`…), each with its line height, letter spacing and weight.

| Token / element        | Font       | Weight | Size   | Line height | Letter spacing | Transform |
| ---------------------- | ---------- | ------ | ------ | ----------- | -------------- | --------- |
| Marquee band           | Rajdhani   | 700    | `48px` (`text-h1`) | `1.1` | — | uppercase, italic |
| `text-h1`              | Inter      | 800    | `48px` | `1.1`       | `-0.02em`      | uppercase |
| `text-h1-mobile`       | Inter      | 800    | `32px` | `1.1`       | `-0.02em`      | uppercase |
| `text-h2` (section title, product page H1) | Inter | 700 | `28px` | `1.2` | `-0.01em` | uppercase |
| `text-h3` (home tabs, card titles, mobile menu links, countdown digits) | Inter | 600 | `20px` | `1.3` | `0` | uppercase where a heading |
| `text-body`            | Inter      | 400    | `15px` | `1.6`       | `0`            | none      |
| `text-product-name` (dialogs, summaries, search rows) | Inter | 500 | `14px` | `1.4` | `0` | none |
| Product card name      | Inter      | 500    | `15px` (`text-[15px]`, also the sticky bar) | `snug` | `0` | none |
| `text-price`           | Inter      | 700    | `16px` | `1`         | `0.02em`       | none      |
| Product card price     | Inter      | 700    | `17px` (`text-[17px]`) | — | `0.01em` | none |
| `text-price-old` (card uses `text-[13px]`, same size) | Inter | 400 | `13px` | `1` | `0` | line-through |
| `text-nav`             | Inter      | 500    | `13px` | `1`         | `0.06em`       | uppercase |
| `text-button`          | Inter      | 600    | `14px` | `1`         | `0.04em`       | uppercase |
| `text-caption`         | Inter      | 400    | `12px` | `1.4`       | `0.02em`       | none      |

### Typography rules
- Headings, nav, buttons, badges and labels are uppercase. Body text, product names and FAQ questions are sentence case.
- **All UI text is Vietnamese** (CLAUDE.md §5). Exceptions decided by the owner: the collection names "Outlet 2026" / "New collection" (2026-10-08), plus the client's own copy "Flash sale", "Back to Basicz", "SPX Express", "Hotline", "COD", "TIKTOK / FANPAGE / ZALO".
- Uppercase Vietnamese keeps its diacritics ("ĐĂNG NHẬP"). Check stacked marks aren't clipped at line height 1 (nav, buttons).
- Rajdhani: marquee band and the login-modal wordmark only. Everything else is Inter.
- Extra letter spacings in use (arbitrary values): `0.04em` trust-row titles, `0.05em` login wordmark, `0.06em` badges / footer headings / quick-add "Size", `0.08em` ticker, `0.14em` manifesto kicker, `0.15em` testimonial stars.
- Inputs use `text-base` (16px) below `lg` so iOS Safari doesn't zoom on focus, `text-product-name` from `lg`.

---

## 4. Component Stylings

### Announcement bar (ticker)
- `AnnouncementBar.tsx`. Above the header, scrolls away with the page (not sticky). ~34px tall.
- `--bg-dark` background, `--text-on-dark` text, `text-caption` uppercase, `tracking 0.08em`, 1px `--border` bottom.
- A marquee: four messages ("Thanh toán COD — nhận hàng rồi mới trả tiền", "Hotline: 0345 267 709", "Giao hàng toàn quốc qua SPX Express", "Bộ sưu tập mới 2026 đã lên kệ") repeated, separated by a red `●`, scrolling left with `animate-ticker` (32s linear, infinite); pauses on hover.
- Dismiss: `×` in a 44px square on the right, on `--bg-dark`. Dismissal lasts until the next page load (component state only).

### Header (one row)
- `Header.tsx`. Sticky `top-0`, `z-40`, 1px `--border` bottom. Background `--bg-primary` at 95% with `backdrop-blur` on a separate `aria-hidden` layer (never on the header itself: it would trap the mobile menu, see docs/LESSONS.md).
- Container `max-w-7xl`, height 64px (72px from `lg`), side padding 16px / 24px.
- **Desktop (≥1024px)**, left to right: logo → nav links (gap 28px) → search (224px, 256px from `xl`, pushed right) → "Đăng nhập / Đăng ký" with a user icon (`text-nav`, becomes "Tài khoản" when signed in) → cart.
- Nav shows four links: Outlet 2026, New collection, Sản phẩm, Đánh giá khách hàng (`NAV_LINKS.slice(1, 5)` in `lib/site.ts`). `text-nav` uppercase, `--text-secondary` → `--text-primary` on hover; active = `--text-primary` + 2px `--accent` underline. Trang chủ, Thương hiệu and Chính sách are only in the mobile menu (Chính sách also in the footer).
- Cart: bag icon in a 44px square, red 20px count badge top-right (`text-caption`, white); the badge pops when a fly-to-cart thumbnail lands.
- **Mobile (<1024px)**: logo left; right side: search icon, cart, hamburger (each 44px). The search icon opens a full-width search row under the header.
- Mobile menu: full-screen white panel, slides in from the right (300ms), `shadow-3` only while open. Close `×` top-right; all seven `NAV_LINKS` centred, `text-h3` uppercase, 48px rows, active = red 2px underline (offset 8px); then "Đăng nhập / Đăng ký" in `text-nav` `--text-secondary`; social icons (Facebook / Instagram / TikTok, 44px) at the bottom. Locks body scroll, closes on Escape.

### Search
- `SearchForm.tsx`: 44px input, `--bg-secondary`, 1px `--border`, `radius-sm`, search icon inside on the left, placeholder "Tìm sản phẩm...". Focus: `--text-primary` border + `--accent-soft` 2px ring.
- After 2+ characters (250ms debounce): a suggestion list under the input (`shadow-2`, `radius-sm`): up to 5 products (36px thumbnail, name, price in red when on sale, "Hết hàng" when sold out) and a "Xem tất cả kết quả" row. Keyboard: ↑ / ↓ / Enter / Escape.

### Breadcrumb
- Inner pages only (not the homepage). `py-3`, `text-nav` weight 400 uppercase. Links `--text-secondary` → `--text-primary` on hover; separator `/` in `--text-muted`; last item `--text-primary`, not a link. Example: `TRANG CHỦ / SẢN PHẨM / ÁO THUN …`.

### Hero carousel
- `HeroCarousel.tsx`. Full width, **16:9 at every width** (`aspect-video`: 711px tall at 1265px, 211px at 375px), `--bg-dark` behind.
- Six slides: slide 1 is a muted looping video (`hero-logo-sting.mp4`, the logo sting "Back to Basicz"), then the client's five product photos (`slide-duck / eagle / polo / sweatshirt / minimalism.jpg`). `object-cover`, no text overlay, no CTA.
- Autoplay every 6s, crossfade 700ms, pauses while hovered. The video restarts each time its slide shows.
- Arrows: 40px dark circles (`bg-bg-dark/50`, blur) at the left / right middle, `‹` / `›`. Dots bottom-centre: 8px white/50 dots, the active one a 24px red pill.

### Marquee band
- `Marquee` in `HomepageV2.tsx`, directly under the carousel. `--bg-dark`, 1px `--border` top and bottom, `py-5`.
- "Paranoidz", "Streetwear Việt Nam", "BST 2026", "Back to Basicz" repeated in Rajdhani italic uppercase at `text-h1`, separated by a red `✦` (`text-h2`), scrolling with `animate-ticker`. Decorative (`aria-hidden`).

### Section header
- Used by category rows, flash sale, lookbook, testimonials: title in `text-h2` uppercase on the left, an optional link or note on the right ("Xem tất cả →", `text-nav` `--text-secondary`), 1px `--border` rule below, 16px under the title, 32px above the content.
- Category rows prefix the title with a red two-digit numeral (`02`, `03`…); the lookbook with a red `✦`, the flash sale with a red `⚡`. Checkout uses the same idea for its steps (`01`, `02` in red before a `text-h3` title).

### Home tabs (Hàng mới / Bán chạy)
- `HomeTabs.tsx`. Left-aligned tabs, 32px apart, `text-h3` uppercase, on a 1px `--border` rule. Active: `--text-primary` with a 3px red underline; inactive: `--text-muted` → `--text-secondary` on hover. ← / → move between tabs.
- Each panel is a product grid of 6 (newest / best sellers).

### Product card
- `ProductCard.tsx`. No border, no card background.
- Image: **1:1** (`aspect-square`), `--bg-secondary`, `radius-sm` (4px), `object-cover`; on hover the photo zooms to 1.04 (300ms).
- Badges **top-left**, flush with the left edge, 12px from the top, stacked 8px apart, square corners, `text-caption` semibold uppercase `tracking 0.06em`, `px-2.5 py-1`:
  - sale: `--accent` bg, white text, `-XX%` (rounded discount from the original price);
  - "Sắp hết hàng": `--warning` bg, `--text-primary` text, when any size has 1–3 left;
  - sold out: "Hết hàng" on `--bg-dark`, white text; replaces the other badges. _(not seen live)_
- Wishlist: top-right, 44px white circle at 90% with blur and `shadow-1`, heart icon (filled when saved). Guests get the login modal.
- **Quick add**, at the bottom edge of the image, not shown when sold out:
  - touch screens (and any device without a fine pointer): a full-width 48px black bar "THÊM NHANH" + bag icon, always visible; it opens the quick-add dialog;
  - mouse / trackpad (`hoverable` variant): the bar is hidden below the image and slides up on hover / keyboard focus (300ms), showing **size pills** for the card's colour on `bg-bg-dark/90`: "SIZE" label, then 36px white squares per size; a click adds that size to the cart straight away (fly-to-cart); out-of-stock sizes are struck through and disabled. _(hover not exercised live)_
- Colour choices under the image: one 44px tap target per colour. With an admin-picked hex: a 28px dot with a 1px `--border`, selected = 2px `--text-primary` ring with 2px offset. Without a hex: a small bordered text chip (`text-caption`, `radius-sm`; selected = `--text-primary` border + text). Picking a colour swaps the photo (every colour's photo is preloaded once the card is hovered, touched or focused). _(live prod shows text chips only; dots not seen live)_
- Text: 8px below the colours (12px with none), 6px gaps, aligned to the image edges:
  - name: 15px, weight 500, `--text-primary`, max 2 lines;
  - price: 17px bold, red when on sale; old price 13px `--text-muted` struck through beside it;
  - rating pill: `--warning` 1px border, `radius-sm`, `★ 4,8 (5)`; hidden with no reviews or an average below 3. _(not seen live)_
- No "freeship" label: shipping is charged at SPX rates (ARCHITECTURE.md).

### Quick-add dialog
- `QuickAdd.tsx`, native `<dialog>`, `shadow-3`, backdrop `bg-bg-dark/60`; a click on the backdrop closes it.
- Below 768px: bottom sheet, full width, 8px (`radius-lg`) top corners, max 85% of the screen tall. From 768px: centred box, `max-w-md`, `radius-sm`.
- Content: 80px square thumbnail + name + price; close `×`; "Màu: …" label + `ColorOptions` (32px dots in 44px targets, or text option buttons); "Size" + size option buttons (stock 0 disabled; a single in-stock size preselected); full-width primary "THÊM VÀO GIỎ" (reads "CHỌN SIZE" until a size is picked; adds 1, closes, flies to the cart); "Xem chi tiết sản phẩm" link. _(dialog not opened live)_

### Option buttons (size, text colours)
- `optionClass` in `ProductView.tsx`: 44px tall, min 48px wide, `px-4`, 1px border, `radius-sm`, `text-button` uppercase. Unselected: `--border`, hover `--text-primary` border. Selected: `--text-primary` fill, white text. Disabled: `--bg-secondary`, `--text-muted`, struck through.

### Product rows
- `ProductRow.tsx`: a horizontal scroll-snap row of product cards: 2 visible on mobile (12px gap), 3 from 640px, 4 from 1024px (16px gap). Scrollbar hidden.
- Dots under the row, one per screenful, only when the row overflows: 8px circles in 44×24px targets, current = `--text-primary`, others `--border-hover`.

### Flash sale
- `FlashSale.tsx`, shown whenever a flash-sale window exists and there are sale products (it replaced the old promotion row).
- Header: red `⚡` + "FLASH SALE" (`text-h2` uppercase) + a "SẮP CHÁY HÀNG" badge (`--warning` bg, `text-caption` bold, `radius-sm`); right side: "KẾT THÚC TRONG" (during a window) or "BẮT ĐẦU LÚC HH:00" (before one) in `text-nav` `--text-secondary`, then a countdown `HH : MM : SS`: each pair in a 36px-min `--bg-dark` box, `text-h3` bold white, tabular numbers.
- A product row of up to 12 on-sale products. During a window the cards show the flash price, and the badge shows the total discount from the original price. "Xem tất cả →" centred below. _(seen live in the "Bắt đầu lúc 12:00" state only)_

### Collection cards
- Up to two, in a 2-column grid from 640px (1 column below), 16px gap. Hidden when there are no active collections. _(not seen live: no collections on prod)_
- 16:10 image (the first photo of the collection's first product) on `--bg-dark` at 80% opacity, a dark gradient from the bottom; name (`text-h3`) and year (`text-caption`, 70%) bottom-left in white uppercase; "Xem →" bottom-right fades in on hover while the photo goes to full opacity and zooms to 1.03.

### Lookbook ("Ngoài đời thật")
- `Lookbook` in `HomepageV2.tsx`. Section header with a red `✦` and "KHÁCH MẶC PARANOIDZ" on the right.
- Six square customer photos (`look-1…6.jpg`), 2 columns, 3 from 1024px, `radius-sm`, zoom 1.03 on hover. Below: two vertical 9:16 TikTok clips side by side (`pdz3-web.mp4`, `pdz4-web.mp4`) with native controls, not autoplaying.

### Manifesto
- Dark block inside the content column: `--bg-dark`, padding 56px × 24px (80px × 48px from `lg`). Kicker "PARANOIDZ" (`text-caption`, `tracking 0.14em`, 60%); "Mặc kệ thiên hạ. / Mặc đẹp cho chính mình." in `text-h2` uppercase (`text-h1` from `lg`); one body line at 70%.

### Trust row
- Homepage: three cells in a 1px `--border` `gap-px` grid (1 column, 3 from 640px), each `p-6` on white: title in `text-nav` bold uppercase, line in `text-caption` `--text-secondary`: "Thanh toán COD", "SPX Express", "Đổi trả 7 ngày".
- Product page: a 2×2 version under the buy buttons, each cell with a 36px `--bg-secondary` icon circle: SPX Express / Thanh toán COD / Đổi trả 7 ngày / Hotline 0345 267 709.

### FAQ
- `Faq.tsx`. Centred title "BẠN CÓ CÂU HỎI GÌ / HÃY ĐỂ CHÚNG TÔI GIẢI ĐÁP" (`text-h2`, `text-h1` from `lg`). Ten questions in a `max-w-3xl` accordion, 1px `--border` between rows; question in `text-nav` bold (sentence case), `⌄` chevron that turns 180° when open; answer in `text-body` `--text-secondary`. The first question starts open; one open at a time.

### Testimonials ("Khách hàng nói gì")
- `Testimonials.tsx`, data in `src/data/testimonials.ts` (8 real 5-star Shopee reviews, names masked).
- Header line: yellow `★★★★★` + "5.0/5 từ đánh giá thật trên Shopee" + link to the Shopee shop.
- Cards in a 1px `--border` `gap-px` grid: 1 column, 2 from 640px, 4 from 1024px. Each `p-6` on white: stars, optional square photo, quote in `text-body`, then a rule and the masked name (`text-nav` semibold) + product · date (`text-caption`).

### Product page
- Grid of 12 from `lg`: gallery 7 columns, info 5 columns (48px gap; 32px stacked below `lg`).
- Gallery: square main image (`--bg-secondary`, `radius-sm`), then 5-column square thumbnails; the current one has a `--text-primary` border. Colourway photos first.
- Info column (sticky from `lg`): name as `text-h2` uppercase H1 + wishlist heart; price `text-h3` bold (red on sale) + old price; "Màu: …" + `ColorOptions`; "Size" + option buttons + "Bảng size" link; "Chỉ còn N sản phẩm" with a yellow dot at ≤ 3; quantity stepper + primary "THÊM VÀO GIỎ"; secondary "MUA NGAY" (skips the cart); trust row.
- Below: bundle offers, then tabs "Chi tiết sản phẩm" / "Bảng size" / "Đánh giá (n)" (`text-nav` bold uppercase, 2px underline on the active one).
- **Sticky buy bar** (all widths): fixed to the bottom, white at 95% with blur, `shadow-2`, shown only while the inline buttons and the footer are both off screen. Thumbnail (56px, from 640px), name (15px), price + chosen colour / size, and a primary button ("THÊM VÀO GIỎ", or "CHỌN SIZE", which scrolls to the sizes).

### Checkout shipping card
- Step "02 Phương thức vận chuyển" in `CheckoutView.tsx`: a bordered white card. 44px `--bg-dark` square with a truck icon; "SPX EXPRESS" (`text-nav` bold uppercase) + "Giao hàng nhanh toàn quốc · Thanh toán khi nhận hàng (COD)"; on the right the fee (`text-price`) with its source ("Giá trực tiếp từ SPX" or "Theo bảng giá chuẩn"), or "Nhập địa chỉ để tính phí" / "Đang tính…". A footer line under a rule: the fee shown is the fee paid.
- The order summary sits in a sticky `--bg-secondary` box (`radius-sm`, `p-6`) on the right from `lg`.

### Order lookup SPX card
- When an order has an SPX tracking number: a `--bg-secondary` bordered box, "MÃ VẬN ĐƠN SPX" label, the number in `text-h3` bold, and "Tra cứu hành trình trên SPX ↗" linking to spx.vn's tracking page. _(not seen live: needs a shipped order)_

### Buttons
- **Primary** (`primaryClass` in `PurchaseActions.tsx`): `--accent` bg, white `text-button` uppercase, 48px tall, `radius-sm`. Hover: `--accent-hover`, lift 1px, `shadow-accent`. Disabled: `--bg-tertiary`, `--text-muted`.
- **Secondary**: transparent, 1px `--text-primary` border and text. Hover: `--text-primary` fill + white text.
- **Dark bar**: the card's quick-add bar: `--bg-dark`, white `text-button`, 48px, square corners; hover `--accent`.
- **Text links**: `text-nav` uppercase `--text-secondary` → `--text-primary` on hover, often with a `→` / `↗`.
- Transitions: 200ms (300ms for zooms and slides).

### Inputs
- Background `--bg-primary` (search: `--bg-secondary`), 1px `--border` (`--accent` when invalid), `radius-sm`, 44px tall, `--text-primary` text, `--text-muted` placeholder.
- Focus: `--text-primary` border + `0 0 0 2px var(--accent-soft)`, no outline.
- Labels: `text-nav` uppercase `--text-secondary`; required `*` in red; optional fields say "(không bắt buộc)".

### Footer
- `Footer.tsx`. `--bg-dark`, `--text-on-dark`. Four columns from 1024px (2 from 640px, 1 below), 40px gap, `py-12`.
  1. Light logo + "HỘ KINH DOANH COOLSHIRTZ" + "Mã số doanh nghiệp: 042097005182".
  2. "KẾT NỐI VỚI PARANOIDZ": rows TIKTOK / FANPAGE / ZALO with `↗`, 1px white/10 rules between, opening in a new tab.
  3. "LIÊN HỆ": support@paranoidz.vn, 57/41/17 Tô Hiệu, P. Phú Thạnh, TP.HCM, and "Hotline: 0345 267 709" in full white `text-button`.
  4. "CHÍNH SÁCH": Chính sách giao hàng, Đổi trả, Chính sách bảo mật, Tra cứu đơn hàng.
- Headings `text-caption` semibold uppercase `tracking 0.06em`; other text `text-caption` at 70%.
- Bottom bar under a white/10 rule: "© 2026 Paranoidz. Bảo lưu mọi quyền." and a bordered "COD" tag. No payment-card icons, no social icons.

### Not built
- Newsletter signup: out of scope (ARCHITECTURE.md §9).

---

## 5. Layout Principles

### Spacing scale
Tailwind's 4px base gives the scale; there are no `--s-*` CSS variables.

| Step    | Value  | Tailwind | Usage                           |
| ------- | ------ | -------- | ------------------------------- |
| `--s-1` | `4px`  | `1`      | Tight gaps, inline spacing      |
| `--s-2` | `8px`  | `2`      | Icon-to-text, compact padding   |
| `--s-3` | `16px` | `4`      | Card padding, grid gaps         |
| `--s-4` | `24px` | `6`      | Section inner padding           |
| `--s-5` | `32px` | `8`      | Between components              |
| `--s-6` | `48px` | `12`     | Between major sections          |
| `--s-7` | `64px` | `16`     | Page section vertical rhythm    |
| `--s-8` | `96px` | `24`     | Hero vertical padding           |

Off-scale values in use: 12px grid gap on mobile (`gap-3`), 56px / 80px between homepage sections (`gap-14` / `lg:gap-20`).

### Grid
- Max content width `1280px` (`max-w-7xl`), centred; side padding 16px, 24px from `lg`.
- Product grid: 2 columns, 3 from 1024px; gap 12px, 16px from 640px.
- Product rows: 2 / 3 / 4 cards visible (see §4).
- The carousel and marquee are full-bleed; everything else on the homepage sits in the content column.

### Page structure
Every page: ticker → sticky header → content → footer (+ the login modal, opened on demand). Inner pages start with the breadcrumb.

Homepage (`app/page.tsx`), top to bottom:
1. Hero carousel (full width)
2. Marquee band (full width)
3. Collection cards (if any active collections)
4. Home tabs: Hàng mới / Bán chạy, 6 products each
5. Flash sale (if a window is set and products are on sale)
6. One product row per category that has products, numbered from `02` _(not seen live: no categories on prod)_
7. Lookbook "Ngoài đời thật"
8. Manifesto (dark)
9. Trust row
10. FAQ
11. Testimonials

---

## 6. Depth & Elevation

| Level  | Token           | Shadow                            | Usage                                          |
| ------ | --------------- | --------------------------------- | ---------------------------------------------- |
| 0      | —               | none                              | Cards, sections                                |
| 1      | `shadow-1`      | `0 1px 3px rgba(0,0,0,0.08)`      | Wishlist circle on cards, review photo controls |
| 2      | `shadow-2`      | `0 4px 12px rgba(0,0,0,0.1)`      | Search suggestions, checkout province / ward lists, sticky buy bar |
| 3      | `shadow-3`      | `0 8px 32px rgba(0,0,0,0.15)`     | Mobile menu (open), quick-add and login dialogs |
| accent | `shadow-accent` | `0 2px 8px rgba(255,45,45,0.3)`   | Primary button hover                           |

### Depth rules
- Product cards have no shadow; feedback on hover is the photo zoom and the quick-add slide.
- Shadows are low-opacity black, except the red glow on primary-button hover.
- A shadow on an off-screen panel bleeds into view: apply it only in the open state.
- Blur (`backdrop-blur`) sits on its own layer, never on an ancestor of a `position: fixed` element.

---

## 7. Do's and Don'ts

### Do
- Keep the shopping area light; let product photos carry the weight.
- Frame the page with full-width dark bands (ticker, marquee, manifesto, footer).
- Use uppercase for headings, nav, buttons and badges; sentence case for body copy and product names.
- Write every label, message and button in Vietnamese with full diacritics.
- Show prices as `₫` + dot separators (`₫269.000`), via `formatVnd`.
- Use 44px minimum touch targets.
- Use 1px `--border` rules to separate: section-header underlines, accordion rows, `gap-px` grids.
- Use the client's own photos and clips (`public/home/`) for hero, lookbook and testimonials.

### Don't
- Don't put dark backgrounds behind product grids, the product page or checkout.
- Don't use more than two font families: Inter, plus Rajdhani for the marquee and the login wordmark.
- Don't put coloured or gradient backgrounds behind product photos.
- Don't round corners beyond `8px`: `4px` (`radius-sm`) is standard, `8px` only for the bottom sheet's top corners; `rounded-full` only for circles and dots.
- Don't paint large red areas. Red stays on buttons, badges, indicators and small markers.
- Don't add decorations beyond the `✦` / `●` / `⚡` markers already used.
- Don't use Tailwind's default colours, radii or shadows: they are removed from the theme and produce no CSS.

---

## 8. Responsive Behavior

| Breakpoint | Width          | Behavior                                                       |
| ---------- | -------------- | -------------------------------------------------------------- |
| Mobile     | `<640px`       | 2-col grid (12px gap), 2 cards per row view, 1-col footer / testimonials / trust row, mobile header |
| Tablet     | `640–1023px`   | 2-col grid (16px gap), 3 cards per row view, 2-col footer / testimonials, 3-col trust row, mobile header |
| `md`       | `≥768px`       | Quick-add opens as a centred dialog instead of a bottom sheet |
| Desktop    | `≥1024px`      | Full header, 3-col grid, 4 cards per row view, 4-col footer / testimonials, product page side by side |

### Mobile specifics (checked at 375px, 2026-10-17)
- Header 64px: logo left; search icon, cart, hamburger right. Page width stays 375px (no horizontal scroll).
- Hero carousel 375 × 211 (16:9).
- Quick-add bar always visible on cards (touch).
- Product page: image full width, trust row 2×2, sticky buy bar at the bottom.
- Footer: single column.

---

## 9. Agent Prompt Guide

### Quick color reference
```
Background:  #FFFFFF (primary), #F5F5F5 (image areas, search), #EBEBEB (disabled, highlighted row)
Dark areas:  #111111 (ticker, marquee, manifesto, footer, quick-add bar, badges)
Text:        #111111 (primary), #666666 (secondary), #999999 (muted)
Accent:      #FF2D2D (red — CTAs, sale, active indicators, numerals, ✦ / ●)
Warning:     #FFD600 (low-stock + flash-sale badges, stars)
Border:      #E0E0E0 (default), #CCCCCC (hover)
```

### Prompts (current design)

**Homepage:**
"Light streetwear homepage for Paranoidz, Vietnamese copy. Black ticker bar with uppercase messages separated by red dots, then a sticky white one-row header: PARANOIDZ logo image left, four uppercase grey nav links, a grey search input, 'Đăng nhập / Đăng ký' and a cart icon with a red count. Full-width 16:9 carousel (logo-sting video, then product photos) with round dark arrows and dots, the active dot a red pill. A black marquee band in Rajdhani italic ('PARANOIDZ ✦ STREETWEAR VIỆT NAM ✦ BST 2026 ✦ BACK TO BASICZ') with red ✦. Then, in a 1280px column: 'HÀNG MỚI / BÁN CHẠY' tabs with a red underline, a 3-column grid of square product cards, a flash-sale row with a black-box countdown, a lookbook of square photos and two vertical clips, a black manifesto block, a three-cell trust row, an FAQ accordion, testimonial cards. Black four-column footer."

**Product card:**
"Borderless product card: square #F5F5F5 image with 4px corners and a slight hover zoom. Top-left, square red '-30%' badge (and a yellow 'SẮP HẾT HÀNG' badge under it when stock is low); top-right, a white circular heart button. At the bottom of the image a black full-width 'THÊM NHANH' bar (on desktop it slides up on hover and shows size buttons). Below: colour dots or chips, product name 15px medium, price 17px bold (red when on sale) with the old price struck through in grey."

**Header:**
"One-row sticky white header, 72px desktop / 64px mobile, slightly translucent with blur, 1px #E0E0E0 bottom border. Desktop: logo, uppercase nav links in grey (active: black with a red 2px underline), search input, account link with icon, cart. Mobile: logo left; search, cart and hamburger icons right; the hamburger opens a full-screen white menu sliding in from the right with large centred uppercase links."

**Footer:**
"Black footer, four columns: light PARANOIDZ logo with the business name and tax code; 'KẾT NỐI VỚI PARANOIDZ' with TIKTOK / FANPAGE / ZALO rows and ↗; 'LIÊN HỆ' with email, address and the hotline 0345 267 709 in full white; 'CHÍNH SÁCH' links. Bottom bar: copyright and a bordered 'COD' tag."
