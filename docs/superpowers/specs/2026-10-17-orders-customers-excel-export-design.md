# Orders + customers Excel export: design

Date: 2026-10-17 · Status: agreed with the owner, not built. Client questions open (end of file).

The client (2026-10-14) wants an Excel copy of orders and customers **for his own records**: invoices,
after-sales, returns / refunds ("xuất hoá đơn hoặc đơn hậu mãi, trả hàng hoàn hàng"). It is never
imported anywhere and has nothing to do with the BigSeller stock files (§3.1): "chỉ lưu ở file excel
thôi, còn import thì chỉ với tồn kho".

## Decisions (owner, 2026-10-17)

- **Two files, two buttons.** `/orders` exports an orders file, `/customers` a customers file.
- **Orders file = two sheets**, so money is never double-counted when summed in Excel:
  "Đơn hàng" (one row per order, totals) and "Sản phẩm" (one row per item).
- **Which orders:** a date range on the order date (Từ ngày / Đến ngày, Vietnam time, both days
  included, default = 1st of this month → today) **plus** whatever the `/orders` page is showing: the
  status tab and the search (order number / phone). "Tất cả" = every status.
- **Which customers:** all of them (the list is small); the `/customers` search applies if one is active.
- **Full personal data** (names, phones, emails, addresses): after-sales and returns need to reach the
  customer. Masked phones were rejected as useless for that.
- **Invoices:** the generic files ship now. The client is asked whether he uses e-invoice software; if
  he sends its import template, a file in that format is a **separate** backlog item (ARCHITECTURE.md §9
  lists other systems' import formats as out of scope until then).
- **No database migration, no new dependency** (`write-excel-file` is already installed).

## Columns

Header row bold, frozen. Money = number cells formatted `#,##0` (no ₫ inside the cell, so Excel can sum
them; the header says ₫). Dates = date cells `dd/mm/yyyy hh:mm`, Vietnam time (UTC+7). **Phones, order
numbers and SKUs are text cells**, so Excel keeps the leading 0 (`0901234567`, not `901234567`).

### "Đơn hàng" (one row per order, newest first)

| Header | Source |
| ------ | ------ |
| Mã đơn | `order_number` |
| Ngày đặt | `created_at` |
| Trạng thái | `STATUS_LABEL[status]` (`lib/order-status.ts`) |
| Ngày giao / hủy | `order_status_history.created_at` of the current status when it is delivered / cancelled / delivery_failed; blank otherwise |
| Người nhận | `recipient_name` |
| SĐT | `phone` |
| SĐT phụ | `secondary_phone` |
| Email | `email` |
| Địa chỉ | `address` |
| Phường / xã | `ward` |
| Tỉnh / TP | `city` |
| Ghi chú | `note` |
| Số SP | sum of `order_items.qty` |
| Tạm tính (₫) | `subtotal` |
| Giảm giá (₫) | `discount` |
| Mã giảm giá | promo `vouchers.code` via `voucher_uses` (shown even if the use was released); `auto_first5` → "5 ĐƠN ĐẦU"; blank when the discount is a combo / flash sale or none |
| Phí ship (₫) | `shipping_fee` |
| Tổng thu COD (₫) | `total` |
| Mã vận đơn SPX | `spx_tracking_no` |
| Có tài khoản | "Có" when `user_id` is set, else blank |

### "Sản phẩm" (one row per order item, same order as the first sheet)

Mã đơn · Ngày đặt · Trạng thái · SKU (`sku_snapshot`) · Tên SP (`name_snapshot`) · Màu (`color_snapshot`) ·
Size (`size_snapshot`) · SL (`qty`) · Đơn giá (₫) (`price_snapshot`) · Thành tiền (₫) (`price_snapshot × qty`,
before the order discount).

### "Khách hàng" (customers file, one row per phone, newest customer first)

| Header | Source |
| ------ | ------ |
| SĐT | `customers.phone` |
| Tên | `recipient_name` of the latest order, else `profiles.full_name` (same rule as the `/customers` list) |
| Email | latest order email that isn't blank |
| Địa chỉ gần nhất | latest order's `address, ward, city` joined with ", " |
| Số đơn | count of orders |
| Đã giao | `delivered_count` |
| Bom hàng | `refusal_count` |
| Bị chặn | "Có" when `is_blacklisted` |
| Tổng đã mua (₫) | sum of `total` of delivered orders |
| Đơn đầu tiên / Đơn gần nhất | first / latest order `created_at` |
| Có tài khoản | "Có" when a profile has this phone |

## UI (DASHBOARD_DESIGN.md §6.2 / §6.4)

- `/orders`, top-right above the tabs: secondary (outline) **XUẤT EXCEL**. It opens an inline row (no
  modal): **Từ ngày** / **Đến ngày** (native date inputs) + primary **TẢI FILE** ("Đang tạo…", disabled
  while running) + a line "Theo tab đang xem: <tab> · tìm '<q>'" so the client knows the filters apply.
  File: `Paranoidz_don-hang_<from>-<to>.xlsx` (e.g. `…_20261001-20261031.xlsx`). No orders →
  "Không có đơn nào trong khoảng này.", no file. From after To → "Ngày bắt đầu phải trước ngày kết thúc."
- `/customers`, top-right: secondary **XUẤT EXCEL**, downloads at once ("Đang tạo…" while running).
  File: `Paranoidz_khach-hang_<YYYYMMDD-HHmm>.xlsx` (Vietnam time).
- Errors: toast "Không thể xuất file. Vui lòng thử lại."
- Nothing in the database changes; no confirmation step.

## Security (ARCHITECTURE.md §2.2)

- Server actions only: `requireAdmin()` first, then the admin client. The file is built per request on
  the server and returned to the admin's browser (base64 → Blob download, like `/inventory/export`).
  It is never written to Storage, cached, logged or emailed by us. No client-side generation from page
  data.
- Inputs are re-validated on the server: dates `YYYY-MM-DD` and From ≤ To, status through
  `isOrderStatus()`, the search through the same sanitising filter as the `/orders` list.
- The client is told (client questions below) that the files hold customers' phones and addresses and
  live on his device.

## Implementation notes

- **PostgREST returns at most 1,000 rows per request** (`max_rows = 1000` in `supabase/config.toml`, same
  on hosted projects). Read orders / customers in `.range()` pages until a short page, or the export
  silently stops at 1,000.
- Pure row builders in `apps/admin/src/lib/exports/records.ts` (orders → two sheets, customers → one),
  with `node:test` unit tests next to `tests/bigseller/stock-files.test.ts`. Server actions next to each
  page (`orders/export-actions.ts`, `customers/export-actions.ts` or in the existing `actions.ts`).
- The `/orders` `searchFilter()` moves from `page.tsx` to a lib module (two call sites now). The
  browser download helper in `components/inventory/ExportFlow.tsx` is shared the same way.
- `write-excel-file` writes several sheets in one call (`sheets: [...]`), with column widths and cell
  `type: String / Number / Date` + `format`.

## Verification (done = all of these)

1. Unit tests: header rows exactly as above; a phone `0901234567` round-trips as text through
   `read-excel-file`; a 2-item order gives 1 row in "Đơn hàng" and 2 in "Sản phẩm"; Vietnam-time date
   bounds (an order at 23:30 VN on the To day is in, one at 00:30 VN the next day is out); the paging
   helper keeps reading past 1,000 rows (fake page source returning 1,000 then 5 rows → 1,005).
2. Playwright admin case: on `/orders` "Đã giao", XUẤT EXCEL → TẢI FILE downloads a file whose "Đơn hàng"
   sheet holds exactly the delivered orders of the range; `/customers` XUẤT EXCEL downloads a file with
   one row per seeded customer.
3. Open both files in Excel (or LibreOffice) once by hand: Vietnamese diacritics, leading zeros,
   summable money columns.
4. `/orders` and `/customers` render at 375px and 1280px with the new button / inline row.

## Out of scope

- Files in an e-invoice / accounting tool's import format (waiting on the client, question 1).
- Collecting a buyer's company name / tax code (MST) at checkout (question 2).
- A "returned after delivery" status or flow (question 6). Today only refusals at the door
  (`delivery_failed`) exist.
- Scheduled / emailed exports, CSV, export history.

## Client questions (to send to aT)

```
Gửi aT, em đang làm phần xuất Excel đơn hàng và khách hàng. aT trả lời giúp em mấy câu này nhé:

1. aT có dùng phần mềm hoá đơn điện tử không (MISA, Viettel, VNPT...)? Nếu có, aT gửi em file Excel mẫu dùng để nhập hoá đơn vào phần mềm đó, em làm thêm 1 file đúng mẫu.
2. Có khách nào cần hoá đơn công ty (tên công ty, mã số thuế) không? Hiện lúc đặt hàng web chưa hỏi thông tin này.
3. File đơn hàng có: mã đơn, ngày đặt, trạng thái, ngày giao / huỷ, tên, SĐT, SĐT phụ, email, địa chỉ, ghi chú, tạm tính, giảm giá, mã giảm giá, phí ship, tổng thu COD, mã vận đơn SPX. Kèm 1 trang chi tiết từng sản phẩm: SKU, tên, màu, size, số lượng, giá. aT cần thêm hay bỏ cột nào không?
4. File khách hàng có: SĐT, tên, email, địa chỉ gần nhất, số đơn, số đơn đã giao, số lần bom hàng, có bị chặn không, tổng tiền đã mua, ngày mua đầu tiên và gần nhất. aT cần thêm gì không?
5. Xuất đơn hàng thì aT chọn từ ngày đến ngày, và chọn trạng thái (ví dụ chỉ đơn đã giao). Như vậy đủ dùng chưa aT?
6. Khi khách nhận hàng rồi mới đổi / trả, aT đang ghi lại ở đâu? Hiện web chỉ có "giao thất bại" (khách không nhận), chưa có "trả hàng sau khi nhận".

Lưu ý: file có SĐT và địa chỉ của khách, aT lưu trên máy mình, đừng gửi vào nhóm chat hay để link công khai nhé.
```

Answers to 3–5 adjust columns / filters before or after the build; 1, 2 and 6 become their own backlog
items if the answer is yes.
