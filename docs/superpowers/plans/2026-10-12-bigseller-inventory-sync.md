# BigSeller inventory sync + "Tồn kho" page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline). Steps use checkbox
> (`- [ ]`) syntax. Spec: `docs/superpowers/specs/2026-10-12-bigseller-inventory-sync-design.md`.
> Deviation from the writing-plans template, agreed with the owner: this plan is executed immediately
> in the same session, so steps give exact signatures, SQL, test cases and commands; the full code
> lives in the files, not duplicated here.

**Goal:** An admin "Tồn kho" area that imports stock (and new products) from BigSeller's Excel export,
lets the client adjust stock with +/-, exports website sales/adjustments as BigSeller stock-out /
stock-in files, plus colour renaming in the product editor.

**Architecture:** One migration adds the bookkeeping columns, the `stock_adjustments` log and five
Postgres functions (adjust, unsent, mark-sent, colour rename, `place_order()` + SKU snapshot). Pure
TypeScript modules under `apps/admin/src/lib/bigseller/` parse and build the Excel files and compute
the sync (unit-tested with `node --test`, no new test dependency); server actions and three pages under
`/inventory` glue them to Supabase. Stock is written only by Postgres functions.

**Tech stack:** Next.js 16 / React 19 admin app, Supabase (Postgres 15+), `read-excel-file` 9.3.12 +
`write-excel-file` 4.1.1 (installed on this branch), Node 24 (`node --test`, native type stripping).

**Branch:** `feat/bigseller-inventory-sync`.

**Constraints found while planning**
- No local database (Docker is off). Migrations are pushed to the **production** project and the
  smoke scripts run against it → **ask the owner before `supabase db push` and before running the DB
  smoke script** (both write to production).
- The existing 55-case smoke suite needs ≥ 4 variants with stock ≥ 8; the catalog is empty since the
  2026-10-12 cleanup, so it can't run until the client's products exist. `place_order()` is checked by
  a body diff (only the SKU snapshot lines may differ) plus the new inventory smoke script, which
  places real orders on a temporary product.
- Admin UI checks need the owner's admin session in the browser pane.

---

## File map

| File | Responsibility |
| --- | --- |
| `supabase/migrations/20261012000001_bigseller_sync.sql` | M1–M5 + `bigseller_unsent()`, `mark_bigseller_sent()`, `place_order()` with `sku_snapshot` |
| `packages/db/src/types.ts` | regenerated (`pnpm --filter @paranoidz/db gen:types`) |
| `packages/db/scripts/inventory-smoke.ts` (+ `smoke:inventory` script) | DB behaviour of the new functions |
| `apps/admin/src/lib/bigseller/sku.ts` | `normalizeSku`, `parseSku` |
| `apps/admin/src/lib/bigseller/inventory-file.ts` | read the Inventory List export → rows + errors; filename timestamp |
| `apps/admin/src/lib/bigseller/listings-file.ts` | read the Shopee listings export → price + colour label per SKU; `suggestPrice` |
| `apps/admin/src/lib/bigseller/sync.ts` | `targetStock`, stock-update plan, new-product grouping |
| `apps/admin/src/lib/bigseller/stock-files.ts` | aggregate export lines, build stock-out / stock-in `.xlsx` |
| `apps/admin/tests/bigseller/*.test.ts` | unit tests (`pnpm --filter admin test`) |
| `apps/admin/src/app/(shell)/inventory/page.tsx` + `actions.ts` | list + `adjustStock` |
| `apps/admin/src/components/inventory/InventoryTable.tsx` | rows with − / + / LƯU |
| `apps/admin/src/app/(shell)/inventory/import/{page,actions}.tsx` + `components/inventory/ImportFlow.tsx` | upload → preview → apply |
| `apps/admin/src/app/(shell)/inventory/export/{page,actions}.tsx` + `components/inventory/ExportFlow.tsx` | build files → confirm |
| `apps/admin/src/components/products/ColorRename.tsx`, `products/actions.ts` (`renameColor`) | editor colour rename |
| `apps/admin/src/lib/product.ts` | SKU NFC-normalised in `validateProduct` |
| `apps/admin/src/lib/nav.ts`, `components/icons.tsx` | "Tồn kho" nav item + icon |
| `ARCHITECTURE.md`, `DASHBOARD_DESIGN.md`, `CLAUDE.md`, `TODO.md` | docs |

---

### Task 1: Migration

- [ ] Write `20261012000001_bigseller_sync.sql`:
  - **M1** `orders.bigseller_exported_at`, `orders.bigseller_restocked_at timestamptz`; partial indexes
    `where bigseller_exported_at is null` and `where bigseller_exported_at is not null and bigseller_restocked_at is null`.
  - **M2** `order_items.sku_snapshot text` + backfill from variants; `place_order()` = the body of
    `20261011000002_order_quote.sql` lines 116–318 **verbatim**, plus `'sku_snapshot', v_variant.sku`
    in the item JSON and the `sku_snapshot` column in the `order_items` insert.
  - **M3** normalise existing SKUs, then `check (sku is null or sku = normalize(btrim(sku), NFC))`.
  - **M4** `stock_adjustments` (RLS on, no policies) + `adjust_variant_stock(p_variant_id uuid, p_delta int, p_reason text default null) returns int`
    — admin/service_role; `INVALID_DELTA` (0 or |Δ| > 100000), one `update … where stock + p_delta >= 0 returning stock, sku`;
    not found → `VARIANT_NOT_FOUND` or `STOCK_NEGATIVE`; null SKU → `SKU_REQUIRED`; log row in the same transaction.
    Grant `authenticated, service_role`.
  - `bigseller_unsent() returns table(variant_id uuid, unsent_out int, unsent_back int, unsent_adj int)` (stable, definer, service_role only).
  - `mark_bigseller_sent(p_out uuid[], p_back uuid[], p_adjustments uuid[]) returns jsonb` (counts) — sets each
    timestamp `now()` only where still null; out: no status filter (an order cancelled after download was
    still uploaded → it becomes "back" next time); back: requires `bigseller_exported_at is not null`. Service_role only.
  - **M5** `rename_product_color(p_product_id uuid, p_from text, p_to text) returns void` — admin/service_role;
    `INVALID_COLOR` (trimmed length 1–40), `COLOR_NOT_FOUND`, `COLOR_EXISTS` (another colour equal ignoring case);
    same name → no-op; updates variants + images. Grant `authenticated, service_role`.
- [ ] Diff the new `place_order()` against the old body: only the two SKU lines differ.
- [ ] Commit `feat(db): BigSeller sync migration`.

### Task 2: SKU + file parsing (TDD)

- [ ] `pnpm --filter admin` script `"test": "node --test tests/"`; tsconfig `allowImportingTsExtensions: true`.
- [ ] Tests first (`tests/bigseller/sku.test.ts`, `inventory-file.test.ts`, `listings-file.test.ts`):
  - `parseSku`: `pdz08-Gray-XL` → {pdz08, Gray, XL}; `QT03-Xám` → {QT03, Xám, Freesize}; `Sck1-Random` →
    {Sck1, Random, Freesize}; `pdz09-Washed-Blue-L` → color `Washed-Blue`; `A-B-C` with non-size last part →
    color `B-C`, Freesize; no dash → color = sku? → **error** (`null`).
  - `normalizeSku`: NFD `QT03-Xám` == NFC; trims.
  - Inventory rows (header + data arrays as read-excel-file returns them, quantities as `"27.0"` strings):
    parses SKU/title/image/warehouse/available; missing header → error naming it; non-`Single SKU` → skipped;
    duplicate SKU → error; `"27.5"` → error; two warehouses → error.
  - `fileTimestamp("Inventory_List20261012172745857.xlsx")` = `2026-10-12T17:27:45.857Z`; other names → null.
  - Listings: pdz01-SP only; special price, list-price fallback when special is 0/empty; two listings in one
    shop → lower; colour label = `Variation` before the comma, trimmed; `suggestPrice(199000, 70)` = 139000,
    `suggestPrice(235000, 70)` = 164000, `suggestPrice(36000, 70)` = 25000.
- [ ] Run → fail; implement; run → pass; commit `feat(admin): BigSeller file parsing`.

### Task 3: Sync planning + export files (TDD)

- [ ] Tests (`sync.test.ts`, `stock-files.test.ts`):
  - `targetStock(27, {out: 2, back: 1, adj: 5})` = 31; never below 0.
  - `planImport(fileRows, variantsBySku, unsentByVariant)` → `updates` (only changed), `unchanged` count,
    `newGroups` (unknown SKUs grouped by code, **excluding codes that already exist** → `knownCodeSkus`),
    `missingFromFile` (website SKUs not in the file).
  - `aggregateLines` sums per SKU and keeps order of first appearance; `stockOutSheet` / `stockInSheet` have
    exactly BigSeller's headers; `chunk(lines, 2000)`; xlsx round trip (write → read-excel-file) gives the same rows.
- [ ] Run → fail; implement; pass; commit `feat(admin): BigSeller sync planning and export files`.

### Task 4: Push migration, types, DB smoke  ⚠ owner approval

- [ ] Ask the owner; then `supabase db push` (linked project), `pnpm --filter @paranoidz/db gen:types`.
- [ ] `packages/db/scripts/inventory-smoke.ts`: temporary active product `zz-smoke-inventory`, variants
  `ZZSMOKE-A` / `ZZSMOKE-B` (stock 10) + one without SKU; phone `0900000011`. Cases: adjust +5 / −20 /
  no SKU / anon denied; place_order → `sku_snapshot`; `bigseller_unsent` out/adj; confirm + mark → 0 and
  second mark is a no-op; cancel → back = 2 → mark → 0; NFD SKU rejected; rename (variants + image row),
  `COLOR_EXISTS`, `COLOR_NOT_FOUND`. Cleans up everything (orders, product, adjustments, customer row,
  AUTO-FIRST5 count restored).
- [ ] Run; all PASS; commit `test(db): inventory smoke script` (+ types).

### Task 5: Product editor — SKU NFC + colour rename

- [ ] `validateProduct`: `sku.normalize("NFC")` before checks.
- [ ] `renameColor(productId, from, to)` in `products/actions.ts` (requireAdmin, rpc as the admin,
  map `COLOR_EXISTS` / `COLOR_NOT_FOUND` / `INVALID_COLOR` to Vietnamese, revalidate `/`).
- [ ] `ColorRename.tsx` ("Màu sắc" card: one row per colour, input + ĐỔI TÊN, toast, `router.refresh()`),
  rendered on `products/[id]/page.tsx` between the images and the form.
- [ ] Lint + build; commit `feat(admin): rename a product colour`.

### Task 6: `/inventory` list + adjust

- [ ] Nav item "Tồn kho" (`/inventory`, `InventoryIcon` = lucide "warehouse") after "Sản phẩm".
- [ ] Page: all variants with product name/slug/active + primary image (catalog is small: filter and
  paginate in JS, 50/page); `bigseller_unsent()`; filters `?status=low|out`, `?hide0=1`, `?q=` (comma-separated
  → exact SKU list, else substring of name or SKU, case-insensitive); totals; NHẬP & XUẤT links.
- [ ] `adjustStock(variantId, delta, reason)` action → rpc as the admin; errors in Vietnamese.
- [ ] `InventoryTable` (client): per row − / number / + editing a pending delta, reason select, LƯU;
  rows without SKU read-only with link to the product.
- [ ] Lint + build; commit `feat(admin): inventory list with stock adjustments`.

### Task 7: Import

- [ ] `previewImport(formData)` / `applyImport(formData)` in `inventory/import/actions.ts`: both re-parse the
  uploaded files (stateless; the client re-sends them with its choices). Stale guard (latest of
  `bigseller_exported_at`, `bigseller_restocked_at`, `stock_adjustments.exported_at` vs the filename
  timestamp; renamed file → requires `confirmFresh`). Apply: create the ticked new products (validate name,
  unique slug, prices > 0, Giá gốc > price or empty) → hidden, variants with stock = available, photos from
  `https://res.bigseller.pro/` only (JPEG/PNG/WebP ≤ 10 MB) into `products/<slug>/<uuid>.<ext>`; then
  recompute targets from fresh stock + unsent and call `set_variant_stocks()` once (CAS with the stock just
  read; `STOCK_CHANGED` → ask to retry).
- [ ] `ImportFlow` (client): two file inputs, % field (70), preview tables, per-group tick / name / price /
  Giá gốc inputs (all variants of a group share one price unless Shopee priced them differently → per-SKU
  inputs), "Tải ảnh từ BigSeller" tick, ÁP DỤNG, result summary.
- [ ] Lint + build; commit `feat(admin): import stock and products from BigSeller`.

### Task 8: Export

- [ ] Page lists unsent lines (out: confirmed/shipped/delivered orders not exported + negative adjustments;
  in: exported-then-cancelled/refused orders + positive adjustments; orders with a SKU-less item → blocked list).
- [ ] `buildExport()` → batch ids + base64 `.xlsx` files (chunks of 2,000); `confirmExport(batch)` →
  `mark_bigseller_sent()` via the service role after `requireAdmin()`.
- [ ] `ExportFlow` (client): TẢI FILE (downloads), upload instructions, ĐÃ NHẬP VÀO BIGSELLER.
- [ ] Lint + build; commit `feat(admin): export sales and adjustments to BigSeller`.

### Task 9: Docs + verification

- [ ] ARCHITECTURE.md (BigSeller sync section, §3 writers, §7 schema, §9), DASHBOARD_DESIGN.md (§4, §6, §6.3, §7),
  CLAUDE.md §4, spec status, TODO.md.
- [ ] `pnpm --filter admin test`, `pnpm --filter admin lint`, `pnpm --filter admin build`,
  `pnpm --filter storefront build` (types changed).
- [ ] Real-file check: preview logic on the 2026-10-12 BigSeller files reproduces the spec's price table.
- [ ] Browser (owner signed in): `/inventory`, import preview, export page at 1280 px.
- [ ] Commit `docs: BigSeller sync`.
