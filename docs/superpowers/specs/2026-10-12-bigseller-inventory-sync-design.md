# BigSeller inventory sync + inventory page — design

Date: 2026-10-12 · Status: draft, awaiting owner review

The client runs Shopee (2 shops) and TikTok Shop through BigSeller. BigSeller keeps the one physical
stock count and pushes it to every marketplace (push rule "sp2tt": 100 % of Default Warehouse
availability → `pdz01-SP`, `pdz02-SP`, `pdz01-TTS`). The website can't join that push: BigSeller only
pushes to authorized marketplace stores, and its Open API is deferred until after launch (TODO.md,
"Backlog — later"). Until then the two systems are kept in step with **Excel files** moved by hand,
and the admin gets the inventory page the client asked for ("làm cái page danh sách tồn kho giống big
ấy", "nhớ thêm chức năng cộng trừ tồn thẳng trên page").

## Decisions (owner, 2026-10-12)

- **BigSeller holds the master stock count.** The website imports it; the website sends back what it
  sold or adjusted. It never sends absolute stock numbers.
- Sales go back as a BigSeller **stock-out** file (not manual orders).
- An order is sent to BigSeller once it is **confirmed** (after the confirmation call).
- **Option A** for the +/- buttons: every website adjustment is logged and sent to BigSeller.
- The import **creates products** for unknown SKUs. A SKU with no size part gets size **"Freesize"**.
  Adding new variants to an *existing* product from the import is **out of v1** (listed only).
- **Website price = 70 % of the Shopee price**, suggested by the import and always editable (client,
  2026-10-12). Which Shopee price is open — see "Open decisions".
- **The product editor can rename a colour** (owner, 2026-10-12). The import therefore no longer
  needs its own colour-label step.
- Shipping weight stays **300 g per unit** (BigSeller records 100 g; not used).
- Placeholder catalog + test orders deleted from production on 2026-10-12 (done; the client enters
  the real catalog).

## What BigSeller gives and accepts (observed 2026-10-12, client account, English UI)

| File | Where in BigSeller | Columns that matter |
| --- | --- | --- |
| Inventory export | Inventory → Inventory List → Import & Export → Export All | Sheet "Single SKU", 28 columns. `Image URL`, `SKU Name`, `Title`, `Warehouse`, `On Hand`, `Order Allocated`, `Available for whole warehouse`, `SKU Type`. Quantities are strings like `27.0`. 70 SKUs, 1 warehouse, all `Single SKU`. No prices (all 0). |
| Stock-out template | Inventory → Manual Stock-Out → Import & Update | Sheet "SKU": `*SKU Name`, `*Stock-Out Qty`, `Serial Number`. ≤ 2,000 lines. Type "Stock-Out / Ordinary" only. |
| Stock-in template | Inventory → Manual Stock-In → Import & Update | Sheet "SKU": `*SKU Name (Either SKU or GTIN is required)`, `*GTIN (Either SKU or GTIN is required)`, `*Stock-In Qty`, `Unit Price`, `Production Date`, `Expiry Date`, `Serial Number`. ≤ 2,000 lines. Type Ordinary or Return (chosen in the dialog, per file). |
| Inventory "Import & Update" | Inventory List | **No quantity column** (`*SKU Name`, `Stock Alert`, `Shelf`, `Weighted Average Cost`, `Sales Status`, `Note`) — cannot set stock. |
| Shopee listings export | Products → Shopee → Active → Import & Export → Export by Page (standard template) | `Online_products_<…>.xlsx`, sheet "sheet1", one row per listing × SKU: `Store Nickname`, `Product Name`, `Item ID`, `Sales`, `Parent SKU`, `Variation`, `SKU`, `Stock`, `Price`, `Special Price`, `activity information` (campaign text). 136 rows = 70 SKUs across 18 listings in 2 shops. |

- Export filenames carry the generation time **in UTC**: `Inventory_List20261012172745857.xlsx` =
  2026-10-12 17:27:45.857 UTC (checked against the download time).
- `Image URL` is a 300×300 thumbnail (`…jpg?imageView2/1/w/300/h/300`); without the query string the
  same URL serves the **1024×1024 original**. Host: `res.bigseller.pro`.
- SKU pattern: `code-Color-Size` (`pdz08-Gray-XL`), some with Vietnamese colours and no size
  (`QT03-Xám`, `QT03-Random`, `Sck1-Random`). Titles are long Shopee titles, and **`pdz01` and
  `pdz08` share the same title** — products must be grouped by SKU code, never by title.
- The client already records off-marketplace sales as manual stock-outs (101 so far).

### Shopee prices (listings export, 2026-10-12)

Every SKU has a list price (`Price`) and a promotion price (`Special Price`); every row is in a running
campaign (windows end 2026-10-14, 2026-11-30, 2027-03-29). The same SKU is priced differently per shop,
and `pdz01-SP` sells `pdz01`/`pdz02`/`pdz08` SKUs in a combined 27-variant listing as well as their own.

| Code | List price | Promotion price | 70 % of list | 70 % of promotion |
| --- | --- | --- | --- | --- |
| pdz01 | 385k (pdz01-SP) / 320k (pdz02-SP) | 235k | 269.5k / 224k | 164.5k |
| pdz02 | 385k | 199k (own listing, pdz01-SP) / 235k (combined listing, pdz02-SP) | 269.5k | 139.3k / 164.5k |
| pdz03, pdz04 | 385k | 199k | 269.5k | 139.3k |
| pdz05, pdz06 | 320k | 235k (pdz01-SP) / 265k (pdz02-SP) | 224k | 164.5k / 185.5k |
| pdz07 | 365k | 245k (pdz01-SP) / 299k (pdz02-SP) | 255.5k | 171.5k / 209.3k |
| pdz08 | 385k (pdz01-SP only) | 235k | 269.5k | 164.5k |
| QT03 socks | 36k | 19k (`QT03-Random`: none) | 25.2k | 13.3k |
| Sck1 gift socks | 60k (QT01) / 36k (`Sck1-Random` in QT02) | 36k / 19k | — | — |

70 % of the **list** price is above Shopee's current promotion price for most shirts (e.g. pdz03: website
269.5k vs Shopee 199k); 70 % of the **promotion** price is below it.

`Variation` holds Shopee's colour/size label, `<colour>,<size spec>`: some Vietnamese (`Đen,L`,
`Trắng kem,M`, `Xanh Be,XL:70–85kg`, `Xám,M: 40-55kg` on pdz02-SP), some English (`Basic Gray`,
`Mint Blue Orb`, `Green Beige`). The size specs (M 40–55 kg, L 55–70 kg, XL 70–85 kg) are a ready
size guide for the client.

## The sync rule

For each variant, the website's stock after an import is:

```
stock = max(0, available − unsent_out + unsent_back + unsent_adj)
```

- `available` — BigSeller "Available for whole warehouse" for that SKU.
- `unsent_out` — units in website orders that already took stock here but BigSeller doesn't know:
  status `pending | confirmed | shipped | delivered` and `bigseller_exported_at is null`.
  (Pending orders count: `place_order()` already decremented them.)
- `unsent_back` — units in orders that were sent to BigSeller and then `cancelled | delivery_failed`
  (stock already restored here) but not yet stocked back in BigSeller: `bigseller_exported_at is not
  null and bigseller_restocked_at is null`.
- `unsent_adj` — sum of `stock_adjustments.delta` with `exported_at is null`.

One read-only SQL function computes these three numbers (`bigseller_unsent()`); the inventory page
and the import both use it, so the logic exists once.

**Stale-file guard.** If a BigSeller file was generated *before* the client uploaded the last batch
of website changes, its `available` doesn't include them, while `unsent_*` no longer counts them →
stock too high → oversell. The import therefore **rejects a file whose filename timestamp is older
than the latest `bigseller_*_at` / `exported_at` mark**. A file whose name doesn't match
`Inventory_List<yyyyMMddHHmmssSSS>.xlsx` (renamed) needs an explicit tick: "File này được xuất từ
BigSeller sau lần gửi gần nhất".

## Database (migrations)

| # | Change | Why |
| --- | --- | --- |
| **M1** | `orders.bigseller_exported_at timestamptz`, `orders.bigseller_restocked_at timestamptz` + partial indexes on the unset ones. Function `mark_bigseller_sent(p_out_order_ids uuid[], p_back_order_ids uuid[], p_adjustment_ids uuid[])`: sets each timestamp to `now()` where still null, in one transaction. | Drives `unsent_out` / `unsent_back` and decides what the next export contains. One function so a batch is never half-marked. Order **status** still changes only through `transition_order_status()`. |
| **M2** | `order_items.sku_snapshot text`; `place_order()` fills it from the variant. | The stock-out file needs a SKU per line, and a variant's SKU can be edited after the order. Follows the existing name/colour/size/price/image snapshots. `place_order()` has been redefined four times — the migration copies the latest body (`20261011000002_order_quote.sql`) verbatim and adds the one column. No backfill needed (no orders exist after the 2026-10-12 cleanup). |
| **M3** | `product_variants` check: `sku is null or sku = normalize(btrim(sku), NFC)`. The editor and the import normalize before saving. | Vietnamese SKUs (`QT03-Xám`) typed on some keyboards arrive decomposed (NFD) and would never match BigSeller's text. Current data is empty, so the constraint is safe to add. |
| **M4** | Table `stock_adjustments (id, variant_id → product_variants on delete set null, sku_snapshot text not null, delta int not null check (delta <> 0), reason text, created_by uuid, created_at, exported_at timestamptz)`, RLS on with no policies. Function `adjust_variant_stock(p_variant_id uuid, p_delta int, p_reason text) returns int`: admin/service_role check; `update product_variants set stock = stock + p_delta where id = p_variant_id and stock + p_delta >= 0 returning stock`; raises `STOCK_NEGATIVE` / `SKU_REQUIRED` / `VARIANT_NOT_FOUND`; inserts the log row in the same transaction. | The +/- buttons (option A). A delta needs no compare-and-set: `stock + delta >= 0` is the atomic guard, and concurrent orders simply compose with it. |
| — | Function `bigseller_unsent()` returning `(variant_id, unsent_out, unsent_back, unsent_adj)` (read-only, `stable`). | Shared by the page and the import (see the sync rule). |
| **M5** | Function `rename_product_color(p_product_id uuid, p_from text, p_to text)` (definer, admin/service_role). | Colour rename in the editor: variants and photos change together or not at all. Touches no stock. |

Stock writers after this change: `place_order()`, `transition_order_status()`, `set_variant_stocks()`
(editor + **import**), and the new `adjust_variant_stock()`. CLAUDE.md §4 and ARCHITECTURE.md §3 must
list the fourth one. The import adds no stock writer — it calls `set_variant_stocks()`.

## Admin pages

New sidebar item **"Tồn kho"** (`/inventory`), after "Sản phẩm". Full pages, no modal CRUD
(DASHBOARD_DESIGN.md §7). All copy in Vietnamese.

### `/inventory` — list (modelled on BigSeller's Inventory List)

- One row per variant: thumbnail, product name, **SKU**, colour / size, **Tồn kho** (website stock),
  **Chờ gửi BigSeller** (`unsent_adj − unsent_out + unsent_back`, signed, hidden when 0), badge
  "Hết hàng" (0) / "Sắp hết" (≤ 3, same threshold as the dashboard low-stock list), product hidden
  marker.
- Filters: Tất cả / Sắp hết / Hết hàng; "Ẩn SKU tồn kho 0"; search by product name or SKU, several SKUs
  separated by commas (as BigSeller). Totals above the table: number of SKUs, total units. 50 per page
  (existing `Pagination`).
- **Adjust**: `−` / `+` change a pending delta shown in the row (or the admin types the delta), an
  optional reason (Nhập hàng / Kiểm kho / Hàng lỗi / Khác), then **LƯU** → `adjust_variant_stock()`.
  Variants without a SKU show the stock read-only with "Thêm SKU trong trang sản phẩm".
- Top-right **NHẬP & XUẤT** menu → "Nhập tồn kho từ BigSeller" (`/inventory/import`), "Xuất sang
  BigSeller" (`/inventory/export`).

### `/inventory/import` — BigSeller → website

1. Upload the Inventory List export (`.xlsx`, ≤ 5,000 rows) and, optionally, the **Shopee listings
   export** (used only for new products: suggested price and colour names). Both are parsed on the
   server by **header name**; an unknown layout (e.g. BigSeller switched to Vietnamese) fails with a
   clear message. Without the listings file, new products get no suggested price.
2. Validation: stale-file guard; one warehouse only; `SKU Type` other than `Single SKU` skipped with a
   warning; duplicate SKUs and non-integer quantities rejected.
3. Preview, three groups:
   - **Cập nhật tồn kho** — SKUs that exist here: current stock, BigSeller available, unsent, new
     stock, difference. Only changed rows are applied.
   - **Sản phẩm mới** — unknown SKUs grouped by code (text before the first `-`). See below.
   - **Chỉ để xem** — unknown SKUs whose code already belongs to an existing product ("thêm biến thể
     trong trang sản phẩm"), and website SKUs missing from the file (left untouched).
4. **ÁP DỤNG**: creates the new products, then applies all stock updates in one
   `set_variant_stocks()` call (expected = stock read when the preview was built). `STOCK_CHANGED`
   (an order landed meanwhile) → "Tồn kho vừa thay đổi, hãy xem lại" and a fresh preview.

### Creating products from the import

Per group (one checkbox each, e.g. untick the `Sck1` gift socks):

| Field | Source |
| --- | --- |
| Name | Pre-filled from `Title`, editable, required. Groups with the same name must be renamed (unique slug). |
| Slug | `slugify(name)` (existing helper), fixed after creation as today. |
| Price | **Suggested** per variant = *Shopee price* × **percentage** (a field on the page, default **70**), **rounded down to ₫1.000** (never above the percentage; 269.500 → ₫269.000). *Shopee price* = the rule chosen under "Open decisions" (which price, which shop; when one shop lists the SKU twice, the lower one). The preview shows the Shopee price it used next to each suggestion. Every price is editable before creating and in the product editor afterwards. No listings file / SKU not found → empty, admin enters it. A price is required (`price > 0`). |
| Variants | Parsed from each SKU: `code-Color-Size`; if the last part isn't a size token (XS…3XL, FREE) or there are only two parts, colour = everything after the code and size = **Freesize**. |
| Colour labels | Prefilled from Shopee's `Variation` (the part before the comma) in the pricing shop when the listings file has it (`Đen`, `Trắng kem`), else the colour from the SKU (`Gray`). Not editable in the preview — renamed afterwards in the product editor (below). The SKU never changes. |
| SKU, stock | Exact SKU (NFC); stock = `available` (a brand-new variant may start with stock, CLAUDE.md §4). |
| Photos | Optional tick (default on): for each colour, the original (query string stripped) of its first SKU's `Image URL` is downloaded by the server — **only from `https://res.bigseller.pro/`**, JPEG/PNG/WebP, ≤ 10 MB — and stored as `products/<slug>/<uuid>.<ext>` with `product_images.color` = the colour label; the first is primary. A failed photo doesn't fail the product. |
| Status | Created **hidden** (`is_active = false`). The client adds description, category, size guide, more photos, then switches it on. |

Creation reuses the editor's validation and insert path (`validateProduct`, SKU clash check); like the
editor it isn't one transaction, and a product whose variants fail to insert is deleted again.

### Product editor — rename a colour

Today an existing variant's colour is plain text in the editor (`ProductForm`), and a colour is joined
to its photos **by name** (`product_images.color` = `product_variants.color`; the storefront's
`ProductView` and cart pick photos that way). So renaming is **per colour, not per row**:

- New block in the editor, "Màu sắc": one row per distinct colour of the product → current name,
  input for the new name, **ĐỔI TÊN** (saved on its own, outside the main form's Save).
- Server action → `rename_product_color(p_product_id, p_from, p_to)` (M5): admin/service_role check;
  trims; 1–40 chars; refuses if `p_to` already exists on the product (case-insensitive, it would merge
  two colours — `COLOR_EXISTS`) or `p_from` doesn't (`COLOR_NOT_FOUND`); then updates
  `product_variants.color` and `product_images.color` for that product in one transaction.
- Unaffected: SKUs, stock, prices, cart lines (by `variant_id`), and order history (`color_snapshot`
  keeps the name at the time of the order). No URL carries a colour.
- Applies to products from the import and products made by hand alike.

### `/inventory/export` — website → BigSeller

- Preview of everything unsent:
  - **Xuất kho (stock-out)**: confirmed / shipped / delivered orders with `bigseller_exported_at is
    null` (by `sku_snapshot`), plus negative adjustments.
  - **Nhập kho (stock-in)**: orders sent and then cancelled / refused (`bigseller_restocked_at is
    null`), plus positive adjustments.
  - Pending orders are not exported (they're covered by `unsent_out` until confirmed). Lines without a
    SKU are listed as blocked.
- **TẢI FILE XUẤT KHO** / **TẢI FILE NHẬP KHO**: `.xlsx` files with exactly BigSeller's template
  headers (sheet "SKU"), one row per SKU with the quantities summed. Empty side → no file. More than
  2,000 lines → split into several files.
- Instructions on the page: upload the stock-out file at Manual Stock-Out → Import & Update (type
  Ordinary), the stock-in file at Manual Stock-In → Import & Update (type Ordinary), note = the batch
  label shown on the page.
- **ĐÃ NHẬP VÀO BIGSELLER** → `mark_bigseller_sent()` with exactly the order / adjustment ids in the
  downloaded files (things that arrived after the download stay unsent). Only press it after BigSeller
  accepted both files; if BigSeller rejects lines, fix them and download again.

## Doc changes (same PR as the code)

- **ARCHITECTURE.md**: new section "BigSeller sync (file-based) — decided 2026-10-12" (master count,
  the sync rule, the stale-file guard, the export flow); §3 lists `adjust_variant_stock()`; §7 adds
  `stock_adjustments` and the new columns/functions; §9 notes the file sync is in scope, the Open API
  is not (yet).
- **DASHBOARD_DESIGN.md**: §4 sidebar gets "Tồn kho"; §6 gets the three pages above; §6.3 Products
  edit gets the "Màu sắc" rename block; §7's "no export" gets an exception for the BigSeller files.
- **ARCHITECTURE.md** also records the pricing rule (website = % of Shopee price, suggested at import,
  editable; the website does not follow later Shopee price changes).
- **CLAUDE.md §4**: add `adjust_variant_stock()` to the allowed stock writers.

## Dependencies

Reading and writing `.xlsx` needs a library (Node has no zip/XLSX reader; BigSeller only exchanges
Excel). Chosen: **`read-excel-file`** (9.3.12, published 2026-10-07; deps `fflate`, `saxen`, …) and
**`write-excel-file`** (4.1.1, 2026-06-08; dep `fflate`), admin app only. Rejected: `exceljs` (last
release 2023-10, heavier dependency tree), `xlsx` on npm (0.18.5 from 2022; SheetJS no longer
publishes to npm). Verify their Node APIs when implementing.

## Verification

- Parser unit tests on the real export (trimmed fixture, no customer data in it) and the three
  templates' headers; SKU parsing cases (`pdz08-Gray-XL`, `QT03-Xám`, `Sck1-Random`, NFD input).
- Price suggestion on the real listings file: chosen basis and shop, lower of two listings in one shop,
  rounding down (385.000 × 70 % → ₫269.000), SKU missing → empty; colour prefill from `Variation`.
- `rename_product_color()`: renames variants + photos together; `COLOR_EXISTS` (incl. case-only
  clash) and `COLOR_NOT_FOUND`; the storefront product page still shows each colour's photos after a
  rename.
- Local Supabase: the sync rule for each case (pending, confirmed-unsent, sent-then-cancelled,
  adjustments); `adjust_variant_stock()` refuses to go below 0 and logs; an order placed between
  preview and apply → `STOCK_CHANGED`; `mark_bigseller_sent()` twice is a no-op; stale file rejected.
- Generated files: headers byte-identical to BigSeller's templates; opened in Excel.
- Pages at 1280 px (admin is desktop-first); Vietnamese copy throughout.
- **Not tested against BigSeller** (owner's instruction: don't touch production BigSeller). The client
  does the first real upload; check the result together.

## Open decisions (client)

1. **Which Shopee price is "the Shopee price"?** The list price (`Price`) or the promotion price
   customers actually pay (`Special Price`)? See the table above — 70 % of the list price makes most
   shirts *dearer* on the website than on Shopee today (pdz03: 269k vs 199k).
2. **Which shop when they differ?** `pdz01-SP` (the main shop: most sales) or the lowest of both?
3. **Show the Shopee price as "Giá gốc"** (strike-through, `original_price`) next to the website price?
   Default: no.

Until answered, the spec's suggestion uses whichever rule the client picks; the percentage field and
manual override work regardless.

## Out of scope (v1)

- Adding variants to existing products from the import.
- Re-pricing existing products from Shopee (the % rule only suggests prices for new products; later
  Shopee price changes are applied by hand in the editor).
- BigSeller manual-order export (with addresses / SPX via BigSeller) — the province names differ
  (`TP. Hồ Chí Minh` vs `Thành phố Hồ Chí Minh`) and would need a mapping.
- BigSeller Open API (automatic sync) — after launch.
- Combination SKUs, multiple warehouses, BigSeller in Vietnamese UI.
