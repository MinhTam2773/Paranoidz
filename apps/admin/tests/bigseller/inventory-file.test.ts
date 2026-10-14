import { test } from "node:test";
import assert from "node:assert/strict";
import { fileTimestamp, parseInventorySheet } from "../../src/lib/bigseller/inventory-file.ts";

// Shaped like read-excel-file's output for BigSeller's "Single SKU" sheet (quantities are text).
const HEADER = [
  "Image URL", "SKU Name", "Title", "GTIN", "Weight(g)", "Warehouse", "On Hand", "Order Allocated",
  "Available for whole warehouse", "SKU Type", "Note",
];
const IMG = "https://res.bigseller.pro/sku/images/merchantsku/1399168/521713_1791771407766.jpg";
const row = (sku: string, available: string | number, opts: { type?: string; warehouse?: string; img?: string | null } = {}) => [
  opts.img === undefined ? `${IMG}?imageView2/1/w/300/h/300` : opts.img, sku, `Áo ${sku}`, null, "100.00",
  opts.warehouse ?? "Default Warehouse", "30.0", "3.0", available, opts.type ?? "Single SKU", null,
];

test("parses rows by header name, quantities given as text", () => {
  const res = parseInventorySheet([HEADER, row("pdz08-Gray-XL", "27.0"), row("QT03-Xám", 19)]);
  assert.deepEqual(res.errors, []);
  assert.deepEqual(res.rows, [
    { sku: "pdz08-Gray-XL", title: "Áo pdz08-Gray-XL", imageUrl: IMG, warehouse: "Default Warehouse", available: 27 },
    { sku: "QT03-Xám", title: "Áo QT03-Xám", imageUrl: IMG, warehouse: "Default Warehouse", available: 19 },
  ]);
});

test("normalises SKUs to NFC and drops empty image cells", () => {
  const res = parseInventorySheet([HEADER, row("QT03-Xám".normalize("NFD"), "1.0", { img: null })]);
  assert.equal(res.rows[0].sku, "QT03-Xám");
  assert.equal(res.rows[0].imageUrl, null);
});

test("missing column → error naming it", () => {
  const res = parseInventorySheet([HEADER.filter((h) => h !== "Available for whole warehouse"), ["x"]]);
  assert.equal(res.rows.length, 0);
  assert.match(res.errors.join(" "), /Available for whole warehouse/);
});

test("combination SKUs are skipped, not imported", () => {
  const res = parseInventorySheet([HEADER, row("combo-1", "5.0", { type: "Combination SKU" }), row("a-B-M", "1.0")]);
  assert.deepEqual(res.skipped, ["combo-1"]);
  assert.deepEqual(res.rows.map((r) => r.sku), ["a-B-M"]);
});

test("bad quantities, duplicates and several warehouses are errors", () => {
  assert.match(parseInventorySheet([HEADER, row("a-B-M", "27.5")]).errors.join(" "), /a-B-M/);
  assert.match(parseInventorySheet([HEADER, row("a-B-M", "-1")]).errors.join(" "), /a-B-M/);
  assert.match(parseInventorySheet([HEADER, row("a-B-M", "1"), row("a-B-M", "2")]).errors.join(" "), /trùng/i);
  assert.match(
    parseInventorySheet([HEADER, row("a-B-M", "1"), row("a-B-L", "1", { warehouse: "Kho 2" })]).errors.join(" "),
    /kho/i,
  );
});

test("reads the Vietnamese-UI export the same way", () => {
  const VI = [
    "Link hình ảnh", "Mã SKU", "Tên", "GTIN", "Cân nặng(g)", "Tên kho", "Tổng số", "Đơn hàng đã khóa",
    "Toàn bộ kho khả dụng", "Loại SKU", "Chú thích",
  ];
  const res = parseInventorySheet([VI, row("pdz08-Gray-XL", "27.0"), row("combo-1", "5.0", { type: "Combination SKU" })]);
  assert.deepEqual(res.errors, []);
  assert.deepEqual(res.skipped, ["combo-1"]);
  assert.deepEqual(res.rows, [
    { sku: "pdz08-Gray-XL", title: "Áo pdz08-Gray-XL", imageUrl: IMG, warehouse: "Default Warehouse", available: 27 },
  ]);
});

test("empty sheet is an error", () => {
  assert.ok(parseInventorySheet([]).errors.length);
  assert.ok(parseInventorySheet([HEADER]).errors.length);
});

test("fileTimestamp reads BigSeller's UTC export time from the name", () => {
  assert.equal(fileTimestamp("Inventory_List20261012172745857.xlsx")?.toISOString(), "2026-10-12T17:27:45.857Z");
  assert.equal(fileTimestamp("inventory.xlsx"), null);
  assert.equal(fileTimestamp("Inventory_List20261012172745857 (1).xlsx")?.toISOString(), "2026-10-12T17:27:45.857Z");
  assert.equal(fileTimestamp("Danh_sách_tồn_kho20261014023733453.xlsx")?.toISOString(), "2026-10-14T02:37:33.453Z");
  // macOS uploads can carry a decomposed (NFD) file name.
  assert.equal(fileTimestamp("Danh_sách_tồn_kho20261014023733453.xlsx".normalize("NFD"))?.toISOString(), "2026-10-14T02:37:33.453Z");
});
