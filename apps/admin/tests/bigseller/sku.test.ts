import { test } from "node:test";
import assert from "node:assert/strict";
import { FREESIZE, normalizeSku, parseSku } from "../../src/lib/bigseller/sku.ts";

test("parseSku: code-Color-Size", () => {
  assert.deepEqual(parseSku("pdz08-Gray-XL"), { code: "pdz08", color: "Gray", size: "XL" });
  assert.deepEqual(parseSku("pdz05-Black-m"), { code: "pdz05", color: "Black", size: "m" });
});

test("parseSku: no size part → Freesize", () => {
  assert.deepEqual(parseSku("QT03-Xám"), { code: "QT03", color: "Xám", size: FREESIZE });
  assert.deepEqual(parseSku("Sck1-Random"), { code: "Sck1", color: "Random", size: FREESIZE });
});

test("parseSku: multi-part colours", () => {
  assert.deepEqual(parseSku("pdz09-Washed-Blue-L"), { code: "pdz09", color: "Washed-Blue", size: "L" });
  assert.deepEqual(parseSku("pdz09-Washed-Blue"), { code: "pdz09", color: "Washed-Blue", size: FREESIZE });
  assert.deepEqual(parseSku("cap1-Black-FREE"), { code: "cap1", color: "Black", size: "FREE" });
});

test("parseSku: unusable SKUs", () => {
  assert.equal(parseSku("pdz08"), null);
  assert.equal(parseSku("-Gray-XL"), null);
  assert.equal(parseSku("pdz08--XL"), null);
  assert.equal(parseSku(""), null);
});

test("normalizeSku: NFC + trim", () => {
  const nfd = "QT03-Xám".normalize("NFD");
  assert.notEqual(nfd, "QT03-Xám");
  assert.equal(normalizeSku(` ${nfd} `), "QT03-Xám");
});
