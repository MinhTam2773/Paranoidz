import { expect, test, type Page } from "@playwright/test";
import { ADMIN_STATE, ADMIN_URL } from "../../env";
import { db, deliverOrder, placeOrder, seedProduct, variantStock } from "../../fixtures/data";

test.use({ baseURL: ADMIN_URL, storageState: ADMIN_STATE });

/** Opens a step, fills what it needs, confirms, waits for the toast. */
async function step(page: Page, label: string, toast: string, fill?: (page: Page) => Promise<void>) {
  await page.getByRole("button", { name: label, exact: true }).click();
  await fill?.(page);
  await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: toast })).toBeVisible();
}

// A16. Return lifecycle in the admin (ARCHITECTURE.md §4 "Returns"): every step goes through
// transition_return(); "Đã nhận hàng" puts the returned unit back in stock; the refund is recorded
// with the suggested amount (price paid minus its share of the order's code discount).
test("A16 return: Chờ duyệt → duyệt → lấy hàng → nhận hàng (stock back) → hoàn tiền", async ({ page }) => {
  const product = await seedProduct([{ size: "M", stock: 5, price: 200_000 }]);
  const variant = product.variants[0];
  const order = await placeOrder({ variantId: variant.id, qty: 2 });
  await deliverOrder(order.id);
  const { data: line } = await db.from("order_items").select("id").eq("order_id", order.id).eq("is_gift", false).single();
  const { data: returnId, error } = await db.rpc("request_return", {
    p_order_number: order.number, p_phone: order.phone, p_reason: "defect", p_note: "Đường may bị bung",
    p_not_washed: true, p_tags_attached: true, p_items: [{ order_item_id: line!.id, qty: 1 }],
    p_image_paths: ["11111111-1111-1111-1111-111111111111.png"],
  });
  expect(error).toBeNull();
  expect(await variantStock(variant.id)).toBe(3);

  await page.goto("/returns");
  await page.getByRole("link", { name: order.number }).first().click();
  await expect(page).toHaveURL(`${ADMIN_URL}/returns/${returnId}`);
  await expect(page.getByText("Đường may bị bung")).toBeVisible();

  await step(page, "Duyệt yêu cầu", "Đã duyệt");
  await step(page, "Đã tạo đơn lấy hàng", "Chờ lấy hàng", (p) => p.getByLabel("Mã vận đơn SPX").fill(`SPXE2E${Date.now()}`));
  await step(page, "Đã nhận hàng (đạt)", "Đã nhận hàng");
  expect(await variantStock(variant.id)).toBe(4);
  await step(page, "Đã hoàn tiền", "Đã hoàn tiền", (p) => p.getByLabel("Ghi chú (ví dụ mã giao dịch)").fill("CK test"));
  await expect(page.getByText("Yêu cầu đã kết thúc, không còn thao tác nào.")).toBeVisible();

  const { data: o } = await db.from("orders").select("discount, gacha_discount, subtotal").eq("id", order.id).single();
  const expected = Math.round(200_000 - ((o!.discount + o!.gacha_discount) * 200_000) / o!.subtotal);
  const { data: r } = await db.from("return_requests").select("status, refund_amount, refund_note, return_status_history(status)").eq("id", returnId!).single();
  expect(r).toMatchObject({ status: "refunded", refund_amount: expected, refund_note: "CK test" });
  expect(r!.return_status_history).toHaveLength(5);
  expect(await variantStock(variant.id)).toBe(4);
});
