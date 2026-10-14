import { test } from "node:test";
import assert from "node:assert/strict";
import readXlsxFile from "read-excel-file/node";
import {
  aggregateLines, chunk, STOCK_IN_HEADER, STOCK_OUT_HEADER, stockInRows, stockOutRows, toXlsx,
} from "../../src/lib/bigseller/stock-files.ts";

test("aggregateLines sums per SKU in first-seen order and drops zero lines", () => {
  assert.deepEqual(
    aggregateLines([{ sku: "b", qty: 1 }, { sku: "a", qty: 2 }, { sku: "b", qty: 3 }, { sku: "c", qty: 0 }]),
    [{ sku: "b", qty: 4 }, { sku: "a", qty: 2 }],
  );
});

test("headers match BigSeller's Vietnamese import templates exactly", () => {
  assert.deepEqual(STOCK_OUT_HEADER, ["*Mã SKU", "*Số lượng xuất kho", "Số seri"]);
  assert.deepEqual(STOCK_IN_HEADER, [
    "*Mã SKU\n(Điều SKU hoặc GTIN)", "*GTIN\n(Điều SKU hoặc GTIN)", "*Số lượng nhập kho",
    "Đơn giá", "Ngày sản xuất", "Ngày hết hạn", "Số seri",
  ]);
  assert.deepEqual(stockOutRows([{ sku: "pdz08-Gray-XL", qty: 2 }])[1], ["pdz08-Gray-XL", 2, null]);
  assert.deepEqual(stockInRows([{ sku: "QT03-Xám", qty: 5 }])[1], ["QT03-Xám", null, 5, null, null, null, null]);
});

test("chunk splits at 2,000 lines", () => {
  const lines = Array.from({ length: 4001 }, (_, i) => i);
  assert.deepEqual(chunk(lines).map((c) => c.length), [2000, 2000, 1]);
  assert.deepEqual(chunk([]), []);
});

test("xlsx round trip: sheet 'SKU', same rows", async () => {
  const buffer = await toXlsx(stockOutRows([{ sku: "QT03-Xám", qty: 3 }, { sku: "pdz08-Gray-XL", qty: 1 }]));
  const sheets = await readXlsxFile(buffer);
  assert.equal(sheets.length, 1);
  assert.equal(sheets[0].sheet, "SKU");
  assert.deepEqual(sheets[0].data, [
    ["*Mã SKU", "*Số lượng xuất kho", "Số seri"],
    ["QT03-Xám", 3, null],
    ["pdz08-Gray-XL", 1, null],
  ]);
});

test("xlsx round trip keeps the line break in the stock-in headers", async () => {
  const sheets = await readXlsxFile(await toXlsx(stockInRows([{ sku: "QT03-Xám", qty: 5 }])));
  assert.deepEqual(sheets[0].data[0], [...STOCK_IN_HEADER]);
});
