import { expect, test } from "../../fixtures/test";
import { db, deliverOrder, placeOrder, seedProduct } from "../../fixtures/data";

// 1×1 PNG: the smallest real image the return-images bucket accepts.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

// S15. Customer return (ARCHITECTURE.md §4 "Returns"): a delivered order found by number + phone
// offers the form; both conditions are required; the request is saved with its photo and the
// lookup then shows "Chờ duyệt" instead of the button.
test("S15 return request: delivered order → form → conditions required → Chờ duyệt @mobile", async ({ page }) => {
  const product = await seedProduct([{ size: "M", stock: 5 }]);
  const order = await placeOrder({ variantId: product.variants[0].id });
  await deliverOrder(order.id);

  await page.goto(`/order-lookup?order=${order.number}`);
  await page.getByLabel("Số điện thoại").fill(order.phone);
  await page.getByRole("button", { name: "Tra cứu đơn hàng" }).click();
  await expect(page.getByRole("heading", { name: "Đã giao" })).toBeVisible();
  await page.getByRole("button", { name: "Yêu cầu trả hàng" }).click();

  await page.getByRole("checkbox", { name: product.name }).check();
  await page.getByRole("radio", { name: "Lỗi sản phẩm" }).check();
  await page.getByRole("button", { name: "Gửi yêu cầu" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "chưa giặt và còn nguyên tem mác" })).toBeVisible();

  await page.getByRole("checkbox", { name: "Sản phẩm chưa giặt, chưa qua sử dụng" }).check();
  await page.getByRole("checkbox", { name: "Sản phẩm còn nguyên tem mác, chưa tháo" }).check();
  await page.getByTestId("return-photos").setInputFiles({ name: "tem-mac.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Gửi yêu cầu" }).click();

  await expect(page.getByText("Chờ duyệt")).toBeVisible();
  await expect(page.getByRole("button", { name: "Yêu cầu trả hàng" })).toHaveCount(0);

  const { data, error } = await db
    .from("return_requests")
    .select("status, reason, not_washed, tags_attached, return_items(qty), return_images(storage_path)")
    .eq("order_id", order.id)
    .single();
  if (error) throw error;
  expect(data).toMatchObject({ status: "requested", reason: "defect", not_washed: true, tags_attached: true, return_items: [{ qty: 1 }] });
  expect(data.return_images).toHaveLength(1);
  expect(data.return_images[0].storage_path.startsWith(`${order.id}/`)).toBe(true);
});
