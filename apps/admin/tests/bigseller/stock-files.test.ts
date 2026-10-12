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

test("headers match BigSeller's import templates exactly", () => {
  assert.deepEqual(STOCK_OUT_HEADER, ["*SKU Name", "*Stock-Out Qty", "Serial Number"]);
  assert.deepEqual(STOCK_IN_HEADER, [
    "*SKU Name (Either SKU or GTIN is required)", "*GTIN (Either SKU or GTIN is required)", "*Stock-In Qty",
    "Unit Price", "Production Date", "Expiry Date", "Serial Number",
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
    ["*SKU Name", "*Stock-Out Qty", "Serial Number"],
    ["QT03-Xám", 3, null],
    ["pdz08-Gray-XL", 1, null],
  ]);
});
