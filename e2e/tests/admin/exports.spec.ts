import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import readXlsxFile from "read-excel-file/node";
import { ADMIN_STATE, ADMIN_URL } from "../../env";
import { db, placeOrder, seedProduct, uniquePhone } from "../../fixtures/data";

test.use({ baseURL: ADMIN_URL, storageState: ADMIN_STATE });

async function deliver(orderId: string) {
  for (const s of ["confirmed", "shipped", "delivered"] as const) {
    const { error } = await db.rpc("transition_order_status", { p_order_id: orderId, p_new_status: s });
    if (error) throw error;
  }
}

async function sheetsOf(page: Page, click: () => Promise<void>) {
  const [download] = await Promise.all([page.waitForEvent("download"), click()]);
  return { name: download.suggestedFilename(), sheets: await readXlsxFile(await readFile((await download.path())!)) };
}

// A14. Orders / customers Excel export (spec 2026-10-17): the orders file follows the tab + search
// within the date range (default: this month), one row per order and one per item; the customers
// file has the phone as text and the delivered total. Both orders share one fresh phone, so the
// search isolates this test's rows from everything else in the database.
test("A14 Excel export: orders by tab + search, customers with totals", async ({ page }) => {
  const product = await seedProduct([{ size: "M", stock: 5 }, { size: "L", stock: 5 }]);
  const phone = uniquePhone();
  const delivered = await placeOrder({ variantId: product.variants[0].id, qty: 2, phone });
  await placeOrder({ variantId: product.variants[1].id, phone }); // stays pending
  await deliver(delivered.id);

  await page.goto(`/orders?status=delivered&q=${phone}`);
  await page.getByRole("button", { name: "Xuất Excel" }).click();
  await expect(page.getByText(`Theo tab đang xem: Đã giao · tìm "${phone}"`)).toBeVisible();
  const orders = await sheetsOf(page, () => page.getByRole("button", { name: "Tải file" }).click());
  expect(orders.name).toMatch(/^Paranoidz_don-hang_\d{8}-\d{8}\.xlsx$/);
  expect(orders.sheets.map((s) => s.sheet)).toEqual(["Đơn hàng", "Sản phẩm"]);

  const [head, ...rows] = orders.sheets[0].data;
  const col = (name: string) => head.indexOf(name);
  expect(rows.map((r) => r[col("Mã đơn")])).toEqual([delivered.number]); // the pending one is filtered out
  expect(rows[0][col("SĐT")]).toBe(phone); // text: leading 0 kept
  expect(rows[0][col("Trạng thái")]).toBe("Đã giao");
  expect(rows[0][col("Số SP")]).toBe(2);
  const items = orders.sheets[1].data.slice(1);
  expect(items).toHaveLength(1);
  expect(items[0][3]).toBe(product.variants[0].sku);

  const { data: order } = await db.from("orders").select("total").eq("id", delivered.id).single();
  await page.goto(`/customers?q=${phone}`);
  const customers = await sheetsOf(page, () => page.getByRole("button", { name: "Xuất Excel" }).click());
  expect(customers.name).toMatch(/^Paranoidz_khach-hang_\d{8}-\d{4}\.xlsx$/);
  const [cHead, ...cRows] = customers.sheets[0].data;
  expect(customers.sheets[0].sheet).toBe("Khách hàng");
  expect(cRows).toHaveLength(1);
  const c = (name: string) => cRows[0][cHead.indexOf(name)];
  expect([c("SĐT"), c("Số đơn"), c("Đã giao"), c("Tổng đã mua (₫)")]).toEqual([phone, 2, 1, order!.total]);
});

// A14b. The open export panel fits a phone screen (no sideways scroll).
test("A14b orders export panel at 375px @mobile", async ({ page }) => {
  await page.goto("/orders");
  await page.getByRole("button", { name: "Xuất Excel" }).click();
  await expect(page.getByRole("button", { name: "Tải file" })).toBeVisible();
  await expect(page.getByLabel("Từ ngày")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
