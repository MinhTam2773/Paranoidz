import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import readXlsxFile from "read-excel-file/node";
import writeXlsxFile from "write-excel-file/node";
import { ADMIN_STATE, ADMIN_URL } from "../../env";
import { db, placeOrder, seedProduct, variantStock } from "../../fixtures/data";

test.use({ baseURL: ADMIN_URL, storageState: ADMIN_STATE });
// Serial: the import refuses a file exported before the last "Đã nhập vào BigSeller" (A12).
test.describe.configure({ mode: "serial" });

// A12. Website → BigSeller: a confirmed order goes out in the stock-out file; marking the batch
// imported clears it. The batch holds every unsent change in the DB, so only this SKU is checked.
test("A12 BigSeller export: confirmed order in the stock-out file, then marked sent", async ({ page }) => {
  const product = await seedProduct([{ size: "M", stock: 5 }]);
  const { id, sku } = product.variants[0];
  const order = await placeOrder({ variantId: id, qty: 2 });
  const { error } = await db.rpc("transition_order_status", { p_order_id: order.id, p_new_status: "confirmed" });
  if (error) throw error;

  await page.goto("/inventory/export");
  const downloads: Promise<string>[] = [];
  page.on("download", (d) => downloads.push(d.path()));
  await page.getByRole("button", { name: "Tải file" }).click();
  await expect(page.getByRole("button", { name: "Đã nhập vào BigSeller" })).toBeVisible();
  await expect.poll(() => downloads.length).toBeGreaterThan(0);

  const sheets = (await Promise.all((await Promise.all(downloads)).map(async (p) => readXlsxFile(await readFile(p))))).flat();
  const stockOut = sheets.find((s) => s.data[0]?.[1] === "*Số lượng xuất kho");
  expect(stockOut, "stock-out file").toBeTruthy();
  expect(stockOut!.data).toContainEqual([sku, 2, null]);

  await page.getByRole("button", { name: "Đã nhập vào BigSeller" }).click();
  await expect
    .poll(async () => ((await db.rpc("bigseller_unsent")).data ?? []).some((u) => u.variant_id === id && u.unsent_out !== 0))
    .toBe(false);
});

// BigSeller names exports in UTC: Inventory_List20261012172745857.xlsx. A minute ahead, so clock
// drift between this machine and the database can't make the file look older than A12's send.
function inventoryFileName() {
  const t = new Date(Date.now() + 60_000).toISOString().replace(/\D/g, "").slice(0, 17);
  return `Inventory_List${t}.xlsx`;
}

// A13. BigSeller → website: the Inventory List export sets stock through set_variant_stocks().
test("A13 BigSeller import: Inventory List file updates an existing SKU's stock", async ({ page }) => {
  const product = await seedProduct([{ size: "M", stock: 5 }]);
  const { id, sku } = product.variants[0];
  const file = await writeXlsxFile(
    [
      ["SKU Name", "Title", "Image URL", "Warehouse", "Available for whole warehouse", "SKU Type"],
      [sku, product.name, "", "Kho mặc định", 9, "Single SKU"],
    ],
    { sheet: "Single SKU" },
  ).toBuffer();

  await page.goto("/inventory/import");
  await page.getByLabel("File tồn kho (bắt buộc)").setInputFiles({
    name: inventoryFileName(),
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: file,
  });
  await page.getByRole("button", { name: "Xem trước" }).click();
  const update = page.getByRole("row").filter({ hasText: sku! });
  await expect(update.getByRole("cell").last()).toHaveText("9");

  await page.getByRole("button", { name: "Áp dụng" }).click();
  await expect(page.getByText("✓ Đã cập nhật tồn kho 1 SKU.")).toBeVisible();
  expect(await variantStock(id)).toBe(9);
});
