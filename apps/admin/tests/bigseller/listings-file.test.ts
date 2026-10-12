import { test } from "node:test";
import assert from "node:assert/strict";
import { parseListingsSheet, shopeePrices, suggestPrice } from "../../src/lib/bigseller/listings-file.ts";

// Shaped like BigSeller's Shopee "Online products" export.
const HEADER = ["Store Nickname", "Product Name", "Item ID", "Parent SKU", "Variation", "SKU", "Stock", "Price", "Special Price"];
const row = (shop: string, sku: string, variation: string, price: number | string, special: number | string | null) =>
  [shop, "Áo", "1", sku.split("-")[0], variation, sku, 10, price, special];

test("parses listing rows", () => {
  const res = parseListingsSheet([HEADER, row("pdz01-SP", "pdz03-Black-M", "Đen,M:40-55kg", 385000, 199000)]);
  assert.deepEqual(res.errors, []);
  assert.deepEqual(res.rows, [{ shop: "pdz01-SP", sku: "pdz03-Black-M", variation: "Đen,M:40-55kg", price: 385000, specialPrice: 199000 }]);
});

test("missing column → error", () => {
  assert.match(parseListingsSheet([HEADER.filter((h) => h !== "Special Price")]).errors.join(" "), /Special Price/);
});

test("shopeePrices: pdz01-SP only, promotion price, lower of two listings, label before the comma", () => {
  const { rows } = parseListingsSheet([
    HEADER,
    row("pdz02-SP", "pdz02-Gray-M", "Duck Gray,M:40-55kg", 385000, 150000), // other shop: ignored
    row("pdz01-SP", "pdz02-Gray-M", "Basic Gray,M:40-55kg", 385000, 235000), // combined listing
    row("pdz01-SP", "pdz02-Gray-M", "Xám,M: 40-55kg", 385000, 199000), // own listing: lower wins
    row("pdz01-SP", "QT03-Random", "Màu Ngẫu Nhiên", 36000, 0), // no promotion → list price
    row("pdz01-SP", "QT03-Đen", "Đen", "36000", ""),
  ]);
  const prices = shopeePrices(rows);
  assert.deepEqual(prices.get("pdz02-Gray-M"), { price: 199000, colorLabel: "Xám" });
  assert.deepEqual(prices.get("QT03-Random"), { price: 36000, colorLabel: "Màu Ngẫu Nhiên" });
  assert.deepEqual(prices.get("QT03-Đen"), { price: 36000, colorLabel: "Đen" });
  assert.equal(prices.size, 3);
});

test("suggestPrice rounds down to ₫1.000", () => {
  assert.equal(suggestPrice(199000, 70), 139000);
  assert.equal(suggestPrice(235000, 70), 164000);
  assert.equal(suggestPrice(245000, 70), 171000);
  assert.equal(suggestPrice(36000, 70), 25000);
  assert.equal(suggestPrice(19000, 70), 13000);
  assert.equal(suggestPrice(1000, 50), 0);
});
