import { test } from "node:test";
import assert from "node:assert/strict";
import { colorLabels, planImport, targetStock, type WebVariant } from "../../src/lib/bigseller/sync.ts";
import type { InventoryRow } from "../../src/lib/bigseller/inventory-file.ts";

const file = (sku: string, available: number, title = `Áo ${sku.split("-")[0]}`): InventoryRow =>
  ({ sku, title, imageUrl: null, warehouse: "Default Warehouse", available });

test("targetStock = max(0, available − out + back + adj)", () => {
  assert.equal(targetStock(27), 27);
  assert.equal(targetStock(27, { out: 2, back: 1, adj: 5 }), 31);
  assert.equal(targetStock(1, { out: 3, back: 0, adj: 0 }), 0);
});

test("planImport: updates only changed variants, using unsent counts", () => {
  const variants: WebVariant[] = [
    { id: "v1", sku: "pdz08-Gray-XL", stock: 20 },
    { id: "v2", sku: "pdz08-Gray-L", stock: 26 }, // 28 − 2 unsent = 26 → unchanged
    { id: "v3", sku: "OLD-Black-M", stock: 4 }, // not in the file
  ];
  const unsent = new Map([["v2", { out: 2, back: 0, adj: 0 }]]);
  const plan = planImport([file("pdz08-Gray-XL", 27), file("pdz08-Gray-L", 28)], variants, unsent);
  assert.deepEqual(plan.updates, [
    { variantId: "v1", sku: "pdz08-Gray-XL", current: 20, available: 27, unsent: { out: 0, back: 0, adj: 0 }, target: 27 },
  ]);
  assert.equal(plan.unchanged, 1);
  assert.deepEqual(plan.missingFromFile, ["OLD-Black-M"]);
  assert.deepEqual(plan.newGroups, []);
});

test("planImport: unknown SKUs grouped by code, known codes only listed", () => {
  const variants: WebVariant[] = [{ id: "v1", sku: "pdz08-Gray-XL", stock: 27 }];
  const plan = planImport(
    [
      file("pdz08-Gray-XL", 27),
      file("pdz08-Blue-M", 5), // code pdz08 exists on the website → listed, not created
      file("pdz03-Black-M", 19, "Áo thun pdz03"),
      file("pdz03-Black-L", 16, "Áo thun pdz03"),
      file("QT03-Xám", 19, "Tất QT03"),
      file("broken", 1),
    ],
    variants,
    new Map(),
  );
  assert.deepEqual(plan.knownCodeSkus, ["pdz08-Blue-M"]);
  assert.deepEqual(plan.unparsable, ["broken"]);
  assert.deepEqual(
    plan.newGroups.map((g) => ({ code: g.code, title: g.title, skus: g.rows.map((r) => `${r.sku}:${r.color}/${r.size}:${r.available}`) })),
    [
      { code: "pdz03", title: "Áo thun pdz03", skus: ["pdz03-Black-M:Black/M:19", "pdz03-Black-L:Black/L:16"] },
      { code: "QT03", title: "Tất QT03", skus: ["QT03-Xám:Xám/Freesize:19"] },
    ],
  );
});

test("colorLabels: Shopee label per colour, SKU colour when missing or colliding", () => {
  const plan = planImport(
    [file("pdz06-Brown-M", 1), file("pdz06-Brown-L", 1), file("pdz06-White-M", 1), file("pdz06-Cream-M", 1), file("pdz06-Red-M", 1)],
    [], new Map(),
  );
  const labels: Record<string, string> = { "pdz06-Brown-L": "Nâu", "pdz06-White-M": "Trắng", "pdz06-Cream-M": "Trắng" };
  const out = colorLabels(plan.newGroups[0], (sku) => labels[sku]);
  assert.deepEqual(Object.fromEntries(out), { Brown: "Nâu", White: "White", Cream: "Cream", Red: "Red" });
});

test("planImport matches SKUs regardless of Unicode form", () => {
  const plan = planImport([file("QT03-Xám", 5)], [{ id: "v1", sku: "QT03-Xám".normalize("NFD"), stock: 1 }], new Map());
  assert.equal(plan.updates[0]?.variantId, "v1");
  assert.deepEqual(plan.newGroups, []);
});
