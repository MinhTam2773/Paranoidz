import { expect, test } from "../../fixtures/test";
import { ADMIN_STATE, ADMIN_URL, STOREFRONT_URL } from "../../env";
import { fillDelivery, placeOrderButton } from "../../fixtures/checkout";
import { createCategory, db, placeOrder, seedProduct, seedReview, uid } from "../../fixtures/data";

test.use({ baseURL: ADMIN_URL, storageState: ADMIN_STATE });

// A9. Add, rename, and delete only while no product uses the category.
test("A9 categories: add, rename, delete blocked while in use", async ({ page }) => {
  const name = `Danh Mục Thử ${uid()}`;
  const renamed = `${name} Mới`;

  await page.goto("/products/categories");
  await page.getByLabel("Tên danh mục mới").fill(name);
  await page.getByRole("button", { name: "Thêm", exact: true }).click();
  await expect(page.getByRole("button", { name: `Sửa ${name}` })).toBeVisible();

  await page.getByRole("button", { name: `Sửa ${name}` }).click();
  await page.getByLabel(`Tên mới cho ${name}`).fill(renamed);
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByRole("button", { name: `Sửa ${renamed}` })).toBeVisible();

  const { data: row } = await db.from("categories").select("id").eq("name", renamed).single();
  const product = await seedProduct([{ size: "M", stock: 1 }]);
  await db.from("products").update({ category_id: row!.id }).eq("id", product.id);
  await page.reload();
  await expect(page.getByRole("button", { name: `Xóa ${renamed}` })).toBeDisabled();

  const unused = await createCategory();
  await page.reload();
  await page.getByRole("button", { name: `Xóa ${unused.name}` }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Xóa danh mục" }).click();
  await expect(page.getByRole("button", { name: `Sửa ${unused.name}` })).toBeHidden();
  const { count } = await db.from("categories").select("id", { count: "exact", head: true }).eq("id", unused.id);
  expect(count).toBe(0);
});

// A10. A phone that ordered is a customer; blacklisting it stops its next online order.
test("A10 customers: listed after an order, blacklist refuses the next order", async ({ page }) => {
  const product = await seedProduct([{ size: "M", stock: 5 }]);
  const order = await placeOrder({ variantId: product.variants[0].id });

  await page.goto(`/customers?q=${order.phone}`);
  await page.locator(`a[href="/customers/${order.phone}"]`).first().click();
  await expect(page).toHaveURL(`${ADMIN_URL}/customers/${order.phone}`);
  await page.getByRole("button", { name: "Thêm vào danh sách đen" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Thêm vào danh sách đen" }).click();
  await expect(page.getByRole("button", { name: "Gỡ khỏi danh sách đen" })).toBeVisible();
  const { data } = await db.from("customers").select("is_blacklisted").eq("phone", order.phone).single();
  expect(data?.is_blacklisted).toBe(true);

  await page.goto(`${STOREFRONT_URL}/checkout?variant=${product.variants[0].id}&qty=1`);
  await fillDelivery(page, { phone: order.phone });
  await placeOrderButton(page).click();
  await expect(page.getByRole("alert").filter({ hasText: "Chúng tôi không thể nhận đơn online cho số điện thoại này." })).toBeVisible();
});

// A11. Hide is the only moderation; the brand reply is stored as PARANOIDZ. The storefront side
// isn't checked: its product page is ISR and the admin can't revalidate it.
test("A11 review moderation: hide a review, add a brand reply", async ({ page }) => {
  const product = await seedProduct([{ size: "M", stock: 5 }]);
  const review = await seedReview(product.id);
  const reply = `Cảm ơn bạn ${uid()}`;

  await page.goto("/reviews");
  const toggle = page.getByRole("row").filter({ hasText: review.content }).getByRole("switch");
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  const { data: hidden } = await db.from("reviews").select("is_visible").eq("id", review.id).single();
  expect(hidden?.is_visible).toBe(false);

  await page.goto(`/reviews?review=${review.id}`);
  await page.getByLabel("Phản hồi với tên PARANOIDZ").fill(reply);
  await page.getByRole("button", { name: "Gửi phản hồi" }).click();
  await expect
    .poll(async () => (await db.from("review_replies").select("is_brand_reply, author_name").eq("review_id", review.id).eq("content", reply)).data)
    .toEqual([{ is_brand_reply: true, author_name: "PARANOIDZ" }]);
});
