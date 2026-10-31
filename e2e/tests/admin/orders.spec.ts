import { expect, test, type Page } from "@playwright/test";
import { ADMIN_STATE, ADMIN_URL } from "../../env";
import { db, placeOrder, seedProduct, variantStock } from "../../fixtures/data";

test.use({ baseURL: ADMIN_URL, storageState: ADMIN_STATE });

/** Clicks an order action, confirms it in the modal, waits for the result toast. */
async function act(page: Page, orderNumber: string, action: string, statusLabel: string) {
  await page.getByRole("button", { name: action, exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: action, exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: `${orderNumber}: ${statusLabel}` })).toBeVisible();
  await expect(page.getByRole("dialog")).toBeHidden();
}

// A2. Every step goes through transition_order_status(); delivery counts toward loyalty.
// A pending order has no confirm button: creating the SPX shipment confirms it, and CI has no
// SPX keys, so the service role stands in for that step.
test("A2 order lifecycle: pending → confirmed → shipped → delivered", async ({ page }) => {
  const product = await seedProduct([{ size: "M", stock: 5 }]);
  const order = await placeOrder({ variantId: product.variants[0].id });

  await page.goto(`/orders/${order.number}`);
  await expect(page.getByRole("button", { name: "Hủy đơn", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Xác nhận đơn", exact: true })).toHaveCount(0);

  const { error } = await db.rpc("transition_order_status", { p_order_id: order.id, p_new_status: "confirmed" });
  expect(error).toBeNull();
  await page.reload();
  await act(page, order.number, "Đánh dấu đang giao", "Đang giao");
  await act(page, order.number, "Đánh dấu đã giao", "Đã giao");
  await expect(page.getByText("Đơn đã kết thúc, không còn thao tác nào.")).toBeVisible();

  const { data: row } = await db.from("orders").select("status, phone").eq("id", order.id).single();
  expect(row?.status).toBe("delivered");
  const { data: history } = await db.from("order_status_history").select("status").eq("order_id", order.id).order("created_at");
  expect(history?.map((h) => h.status)).toEqual(["pending", "confirmed", "shipped", "delivered"]);
  const { data: customer } = await db.from("customers").select("delivered_count").eq("phone", row!.phone).single();
  expect(customer?.delivered_count).toBe(1);
});

// A3. Cancelling returns the stock and releases the order's voucher use (PDZWELCOME).
test("A3 cancel a pending order: stock restored, voucher slot released", async ({ page }) => {
  const product = await seedProduct([{ size: "M", stock: 5 }]);
  const variant = product.variants[0];
  const order = await placeOrder({ variantId: variant.id, qty: 2 });
  expect(await variantStock(variant.id)).toBe(3);

  await page.goto(`/orders/${order.number}`);
  await act(page, order.number, "Hủy đơn", "Đã hủy");

  expect(await variantStock(variant.id)).toBe(5);
  const { data: uses } = await db.from("voucher_uses").select("released_at").eq("order_id", order.id);
  expect(uses).toHaveLength(1);
  expect(uses![0].released_at).not.toBeNull();
});
