# DASHBOARD_DESIGN.md — Paranoidz Admin Panel

> Agent-friendly design system for admin.paranoidz.com.
> Same brand DNA as the storefront (see DESIGN.md), tuned for a data-dense back office.
> Single admin user (the client). Optimize for speed and clarity, not marketing polish.

---

## 1. Visual Theme & Atmosphere

- **Relationship to storefront**: Shares the Paranoidz identity — Inter, sharp 4px corners, red `#FF2D2D` accent — but utilitarian. No lifestyle photography, no hero sections.
- **Layout DNA**: Dark fixed sidebar + light content area. The dark sidebar is the "inverted section" allowance from the brand rules and instantly distinguishes admin from storefront.
- **Mood**: Calm, scannable, operational. The client checks this on a phone between deliveries — clarity beats density.
- **Logo**: White "PARANOIDZ" wordmark (Rajdhani 700, italic, uppercase) at the top of the sidebar, with a small "ADMIN" label beneath it in `--text-muted`.

---

## 2. Color Palette & Roles

All storefront tokens from DESIGN.md apply. Admin adds:

| Token                  | Hex       | Role                                    |
| ---------------------- | --------- | --------------------------------------- |
| `--sidebar-bg`         | `#111111` | Fixed sidebar background                |
| `--sidebar-text`       | `#FFFFFF` | Sidebar link text (70% opacity default) |
| `--sidebar-active`     | `#FF2D2D` | Active nav item left border + icon      |
| `--content-bg`         | `#F5F5F5` | Content area background                 |
| `--surface`            | `#FFFFFF` | Cards, tables, forms sit on white       |

### Order status colors (badges)

| Status            | Text      | Background |
| ----------------- | --------- | ---------- |
| `pending`         | `#B45309` | `#FEF3C7`  |
| `confirmed`       | `#1D4ED8` | `#DBEAFE`  |
| `shipped`         | `#6D28D9` | `#EDE9FE`  |
| `delivered`       | `#047857` | `#D1FAE5`  |
| `cancelled`       | `#6B7280` | `#F3F4F6`  |
| `delivery_failed` | `#B91C1C` | `#FEE2E2`  |

### Color rules
- Content area is `--content-bg` (#F5F5F5); every card/table/form sits on a white `--surface` with `1px solid --border`.
- Red is reserved for: active nav indicator, destructive actions, primary CTAs, and alert badges (e.g. new-order count). Never decorative.
- Status colors appear ONLY in badges — never as row backgrounds or large fills.

---

## 3. Typography

Inter everywhere. Rajdhani 700 for the sidebar wordmark only.

| Element             | Weight | Size   | Transform |
| ------------------- | ------ | ------ | --------- |
| Page title          | 700    | `24px` | uppercase |
| Section/card title  | 600    | `16px` | uppercase |
| Table header        | 600    | `12px` | uppercase, `letter-spacing: 0.05em`, `--text-secondary` |
| Table cell          | 400    | `14px` | none      |
| Form label          | 500    | `13px` | uppercase |
| Input text          | 400    | `14px` | none      |
| Badge               | 600    | `12px` | uppercase |
| Sidebar link        | 500    | `14px` | uppercase, `letter-spacing: 0.04em` |
| Stat card number    | 700    | `28px` | none      |
| Stat card label     | 400    | `12px` | uppercase, `--text-secondary` |

Prices always Vietnamese Dong: `₫` prefix, dot separators (`₫1.240.000`).

---

## 4. Layout

### Shell
- **Sidebar**: fixed left, `240px` wide, full height, `--sidebar-bg`. Logo block on top, nav below, logout pinned to bottom.
- **Topbar**: `64px`, white, bottom border `--border`. Left: page title. Right: "View store ↗" link + admin avatar.
- **Content**: `--content-bg`, padding `24px`, max-width `1200px`.

### Sidebar navigation (order matters)
1. DASHBOARD
2. ORDERS (red count badge for pending orders)
3. PRODUCTS
4. CUSTOMERS
5. BUNDLES
6. COLLECTIONS
7. PROMO CODES
8. GIFT POOL
9. REVIEWS

- Default link: white at 70% opacity, icon left (20px, lucide).
- Hover: 100% opacity, `rgba(255,255,255,0.06)` background.
- Active: 100% opacity, `3px` red left border, `rgba(255,45,45,0.10)` background.

### Mobile (<768px)
- Sidebar collapses to a hamburger sheet sliding from left (dark, same items, 48px touch targets).
- Tables collapse to stacked cards: primary field bold on top, metadata below, badge top-right.
- Topbar keeps page title + hamburger.

---

## 5. Components

### Stat card
White surface, `4px` radius, `1px --border`, padding `20px`. Label (uppercase, muted) over number. Optional delta text in `--success` / `--accent`. 4-across on desktop, 2×2 tablet, stacked mobile.

### Data table
- White surface, header row `--bg-secondary` (#F5F5F5), uppercase 12px headers.
- Rows `56px`, bottom border `--border`, hover `--bg-secondary`.
- Row click navigates to detail. Explicit actions live in a right-aligned kebab menu — no bare icon rows.
- Pagination: "‹ 1 2 3 ›" bottom-right, 20 rows/page. Filters + search input top-left above the table, primary action button top-right.
- Empty state: centered muted icon + one sentence + primary action.

### Status badge
Pill, `12px` semibold uppercase, colors from section 2. `4px` radius, padding `4px 10px`.

### Buttons
Same as storefront (DESIGN.md): Primary red / Secondary outline / Ghost. Add **Destructive**: red outline, red text; fills red on hover. Height `40px` in admin (denser than storefront's 48px).

### Forms
- Labels above inputs. Inputs: white, `1px --border`, `4px` radius, `40px` height, focus ring `--accent-soft`.
- Two-column form grid on desktop, single column mobile.
- Sticky footer bar on long forms: Cancel (ghost) + Save (primary) right-aligned.
- Inline validation under the field in `--accent`, `12px`.

### Image uploader (products)
Drag-and-drop zone, dashed `--border`, uploads to Supabase Storage. Thumbnail grid `80px` squares, drag to reorder (order = `sort_order`), star icon marks `is_primary`, × removes.

### Modal
Centered, white, `4px` radius, Level 2 shadow, max-width `480px`. Used ONLY for confirmations (delete, blacklist, cancel order). Everything else is a full page — no modal CRUD.

### Toast
Bottom-right, dark `#111111` background, white text, 3s auto-dismiss. Success prefix ✓ in `--success`, error prefix ✕ in `--accent`.

---

## 6. Page Inventory (content spec)

### 6.1 Dashboard (home)
- Stat cards: Pending orders, Orders today, Revenue this month (₫), Total customers.
- "Latest orders" table (10 most recent: order number, customer, total, status, time ago) → links to Orders.
- Low-stock list: variants with stock ≤ 3 (product, variant, stock count) → links to product edit.

### 6.2 Orders
- **List**: filter tabs by status (ALL / PENDING / CONFIRMED / SHIPPED / DELIVERED / CANCELLED / FAILED), search by order number or phone. Columns: order number, customer name, phone, items count, total, status badge, created at.
- **Detail**: customer block (name, phones, email, address, note; refusal count + blacklist indicator), items table with snapshots, totals block (subtotal / discount + voucher code / total), status timeline, and a single primary action that advances the lifecycle (pending→CONFIRM, confirmed→SHIP, shipped→DELIVERED) plus secondary Cancel / Delivery failed where valid. Every transition calls `transition_order_status()` — never a raw status write.

### 6.3 Products
- **List**: thumbnail, name, category, price range, total stock, active toggle, updated at. Search + category filter. "ADD PRODUCT" primary top-right.
- **Edit/Create**: name, slug (auto), category, description, care instructions, size guide, active toggle; variant matrix (color × size → price, original price, stock, SKU per row); image uploader per product with variant assignment.

### 6.4 Customers
- **List**: name, phone, email, delivered count, refusal count, blacklist badge, joined date. Search by name/phone.
- **Detail**: profile info, addresses, full order history table, loyalty progress ("7 / 10 delivered → next gift"), pending `loyalty_awards`, blacklist toggle (confirmation modal).

### 6.5 Bundles
List (name, items count, discount, active) + edit page: name, product picker (search + multi-select with thumbnails), discount amount (₫), active toggle. Live preview of combined price vs bundle price.

### 6.6 Collections
List with drag-to-reorder (`sort_order`). Edit: name, slug, active, product picker with drag-to-reorder inside the collection.

### 6.7 Promo codes
List (code, discount %, cap, uses/max, active, expires). Create form: code (uppercase enforced), discount %, cap amount ₫, max uses, expiry date. Deactivate toggle inline. Auto first-5-orders vouchers are system-managed and NOT listed here.

### 6.8 Gift pool
Grid of gift cards (image, name, description, active toggle). "ADD GIFT" form: name, description, image upload. Banner on top if any `loyalty_awards` are pending with an empty pool ("2 customers waiting for a gift — add gifts to fulfill").

### 6.9 Reviews
List: product, customer, rating stars, content preview, visible toggle, date. Detail drawer: full text + replies thread + "Reply as PARANOIDZ" input (sets `is_brand_reply`). Hide/show is the only moderation — no deletes.

---

## 7. Do's and Don'ts

### Do
- Keep every mutation behind an explicit button with a loading state; disable while pending.
- Confirm destructive/irreversible actions (delete, blacklist, cancel) with a modal that names the object.
- Show ₫ totals everywhere money appears; never raw numbers.
- Render status ONLY via the badge component with the exact colors above.
- Keep list → detail navigation consistent: click row = open detail.

### Don't
- NEVER write order status directly — every change goes through `transition_order_status()`.
- NEVER build modal-based CRUD for products/bundles/collections — full pages only.
- NEVER introduce new colors, fonts, or radii beyond this file + DESIGN.md.
- NEVER show the service_role key or any Supabase internals in the UI.
- NEVER add features not in ARCHITECTURE.md scope (no analytics charts, no export, no multi-admin).

---

## 8. Agent Prompt Guide

### Shell
"Build the admin shell: fixed 240px dark (#111111) sidebar with white PARANOIDZ wordmark (Rajdhani 700 italic uppercase) + small ADMIN label, nav items DASHBOARD/ORDERS/PRODUCTS/CUSTOMERS/BUNDLES/COLLECTIONS/PROMO CODES/GIFT POOL/REVIEWS with lucide icons, active item has 3px red (#FF2D2D) left border and red-tinted background, logout pinned bottom. 64px white topbar with page title left, 'View store' link and avatar right. Content area #F5F5F5 with 24px padding, max-width 1200px. Mobile: sidebar becomes a left slide-in sheet behind a hamburger."

### Orders list
"Build the Orders page: status filter tabs (ALL, PENDING, CONFIRMED, SHIPPED, DELIVERED, CANCELLED, FAILED), search by order number or phone. White table on #FFFFFF surface: ORDER NUMBER, CUSTOMER, PHONE, ITEMS, TOTAL (₫ dot format), STATUS (badge with the exact status colors from DASHBOARD_DESIGN.md section 2), CREATED. 56px rows, hover #F5F5F5, click opens order detail. Pagination 20/page bottom-right."

### Order detail
"Build the Order detail page: header with order number + status badge + created date. Left column: customer card (name, both phones, email, full address, order note, refusal count, blacklist indicator) and items table using snapshots (image, name, variant, qty, price ₫). Right column: totals card (subtotal, discount with voucher code, total) and a status card with a vertical timeline of transitions and one primary action button for the next valid transition (CONFIRM ORDER / MARK SHIPPED / MARK DELIVERED) plus ghost buttons for Cancel and Delivery failed when valid, each behind a confirmation modal."

(每 page in section 6 follows the same pattern: paste the relevant spec block + the shell context.)