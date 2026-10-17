import { test } from "node:test";
import assert from "node:assert/strict";
import readXlsxFile from "read-excel-file/node";
import {
  CUSTOMER_HEADER, customerSheet, customersXlsx, fetchAll, ITEM_HEADER, ORDER_HEADER, orderSheets, ordersXlsx, vnDayRange,
  type CustomerOrder, type OrderRow,
} from "../src/lib/exports/records.ts";

const item = (sku: string, qty: number, price: number) =>
  ({ sku_snapshot: sku, name_snapshot: `Áo ${sku}`, color_snapshot: "Đen", size_snapshot: "M", qty, price_snapshot: price });

const order = (over: Partial<OrderRow> = {}): OrderRow => ({
  order_number: "PZ-2026-0001", created_at: "2026-10-01T03:00:00Z", status: "pending",
  recipient_name: "Nguyễn Văn Á", phone: "0901234567", secondary_phone: null, email: null,
  address: "1 Lê Lợi", ward: "Phường Bến Thành", city: "TP. Hồ Chí Minh", note: null,
  subtotal: 400_000, discount: 40_000, shipping_fee: 30_000, total: 390_000,
  spx_tracking_no: null, user_id: null,
  order_items: [item("PDZ01-DEN-M", 1, 200_000), item("PDZ02-DEN-M", 1, 200_000)],
  order_status_history: [{ status: "pending", created_at: "2026-10-01T03:00:00Z" }],
  voucher_uses: [],
  ...over,
});

const value = (c: unknown) => (c && typeof c === "object" && "value" in c ? (c as { value: unknown }).value : c);

test("headers are the spec's columns", () => {
  assert.equal(ORDER_HEADER.length, 20);
  assert.deepEqual([...ITEM_HEADER], ["Mã đơn", "Ngày đặt", "Trạng thái", "SKU", "Tên SP", "Màu", "Size", "SL", "Đơn giá (₫)", "Thành tiền (₫)"]);
  assert.equal(CUSTOMER_HEADER.length, 12);
});

test("a 2-item order is one row in Đơn hàng and two in Sản phẩm (totals never repeat)", () => {
  const s = orderSheets([order()]);
  assert.equal(s.orders.length, 2);
  assert.equal(s.items.length, 3);
  assert.deepEqual(s.items.slice(1).map((r) => [value(r[3]), value(r[7]), value(r[9])]), [["PDZ01-DEN-M", 1, 200_000], ["PDZ02-DEN-M", 1, 200_000]]);
  const row = s.orders[1].map(value);
  assert.equal(row[ORDER_HEADER.indexOf("Số SP")], 2);
  assert.equal(row[ORDER_HEADER.indexOf("Tổng thu COD (₫)")], 390_000);
  assert.equal(row[ORDER_HEADER.indexOf("Trạng thái")], "Đã tiếp nhận");
  assert.equal(row[ORDER_HEADER.indexOf("Ngày giao / hủy")], null); // still open → empty cell
});

test("closed date, voucher label and account flag", () => {
  const [, row] = orderSheets([
    order({
      status: "delivered", user_id: "u1",
      order_status_history: [
        { status: "pending", created_at: "2026-10-01T03:00:00Z" },
        { status: "delivered", created_at: "2026-10-04T10:15:00Z" },
      ],
      voucher_uses: [{ vouchers: { code: "AUTO-FIRST5", type: "auto_first5" } }],
    }),
  ]).orders;
  const v = row.map(value);
  // 10:15 UTC = 17:15 VN; the cell holds VN wall-clock time.
  assert.equal((v[ORDER_HEADER.indexOf("Ngày giao / hủy")] as Date).toISOString(), "2026-10-04T17:15:00.000Z");
  assert.equal(v[ORDER_HEADER.indexOf("Mã giảm giá")], "5 ĐƠN ĐẦU");
  assert.equal(v[ORDER_HEADER.indexOf("Có tài khoản")], "Có");
  const [, promo] = orderSheets([order({ voucher_uses: [{ vouchers: { code: "SALE10", type: "promo" } }] })]).orders;
  assert.equal(value(promo[ORDER_HEADER.indexOf("Mã giảm giá")]), "SALE10");
});

test("customer row: latest name / address, delivered total, first and latest order", () => {
  const o = (created_at: string, status: CustomerOrder["status"], total: number, over: Partial<CustomerOrder> = {}): CustomerOrder =>
    ({ phone: "0901234567", recipient_name: "Tên Cũ", email: null, address: "1 Lê Lợi", ward: "Phường Bến Thành", city: "TP. Hồ Chí Minh", status, total, created_at, ...over });
  const rows = customerSheet(
    [{ phone: "0901234567", delivered_count: 1, refusal_count: 1, is_blacklisted: true }, { phone: "0911111111", delivered_count: 0, refusal_count: 0, is_blacklisted: false }],
    [
      o("2026-10-01T00:00:00Z", "delivered", 300_000, { email: "a@b.vn" }),
      o("2026-10-03T00:00:00Z", "delivery_failed", 250_000),
      o("2026-10-05T00:00:00Z", "pending", 200_000, { recipient_name: "Tên Mới", address: "9 Hai Bà Trưng", ward: null }),
    ],
    new Map([["0911111111", "Tên Tài Khoản"]]),
  );
  const v = rows[1].map(value);
  assert.deepEqual(v.slice(0, 9), ["0901234567", "Tên Mới", "a@b.vn", "9 Hai Bà Trưng, TP. Hồ Chí Minh", 3, 1, 1, "Có", 300_000]);
  assert.equal((v[9] as Date).toISOString(), "2026-10-01T07:00:00.000Z");
  assert.equal((v[10] as Date).toISOString(), "2026-10-05T07:00:00.000Z");
  assert.equal(v[11], null);
  assert.deepEqual(rows[2].map(value).slice(0, 5), ["0911111111", "Tên Tài Khoản", null, null, 0]);
  assert.equal(value(rows[2][11]), "Có");
});

test("vnDayRange: both days included, in Vietnam time", () => {
  const r = vnDayRange("2026-10-01", "2026-10-31")!;
  assert.equal(r.gte, "2026-09-30T17:00:00.000Z");
  assert.equal(r.lt, "2026-10-31T17:00:00.000Z");
  const inRange = (iso: string) => iso >= r.gte && iso < r.lt;
  assert.equal(inRange(new Date("2026-10-31T23:30:00+07:00").toISOString()), true);
  assert.equal(inRange(new Date("2026-11-01T00:30:00+07:00").toISOString()), false);
  assert.equal(inRange(new Date("2026-10-01T00:00:00+07:00").toISOString()), true);
  assert.deepEqual(vnDayRange("2026-10-05", "2026-10-05"), { gte: "2026-10-04T17:00:00.000Z", lt: "2026-10-05T17:00:00.000Z" });
  assert.equal(vnDayRange("2026-10-06", "2026-10-05"), null);
  assert.equal(vnDayRange("2026-10-xx", "2026-10-05"), null);
  assert.equal(vnDayRange("2026-13-01", "2026-13-02"), null);
});

test("fetchAll keeps reading past PostgREST's 1,000-row page", async () => {
  const rows = Array.from({ length: 1005 }, (_, i) => i);
  const calls: [number, number][] = [];
  const all = await fetchAll(async (from, to) => (calls.push([from, to]), { data: rows.slice(from, to + 1), error: null }));
  assert.equal(all.length, 1005);
  assert.deepEqual(calls, [[0, 999], [1000, 1999]]);
  await assert.rejects(fetchAll(async () => ({ data: null, error: new Error("boom") })), /boom/);
});

test("the files keep phones as text and money as numbers, in named sheets", async () => {
  const sheets = await readXlsxFile(await ordersXlsx([order()]));
  assert.deepEqual(sheets.map((s) => s.sheet), ["Đơn hàng", "Sản phẩm"]);
  const [head, row] = sheets[0].data;
  assert.deepEqual(head, [...ORDER_HEADER]);
  assert.equal(row[ORDER_HEADER.indexOf("SĐT")], "0901234567");
  assert.equal(row[ORDER_HEADER.indexOf("Tổng thu COD (₫)")], 390_000);
  assert.equal(sheets[1].data.length, 3);

  const customers = await readXlsxFile(await customersXlsx(customerSheet([{ phone: "0301234567", delivered_count: 0, refusal_count: 0, is_blacklisted: false }], [], new Map())));
  assert.equal(customers[0].sheet, "Khách hàng");
  assert.equal(customers[0].data[1][0], "0301234567");
});
