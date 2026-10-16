import { expect, test } from "../../fixtures/test";
import { storefrontLogin } from "../../fixtures/auth";
import { createUser, deliverOrder, placeOrder, seedProduct, setProfilePhone, uid, uniquePhone } from "../../fixtures/data";

// S10. Only an account whose phone received the product may review it (has_delivered_product()).
test.describe("S10 reviews", () => {
  test("a customer without a delivered order can't review", async ({ page }) => {
    const product = await seedProduct([{ size: "M", stock: 5 }]);
    const customer = await createUser();
    await setProfilePhone(customer.id, uniquePhone());

    await storefrontLogin(page, customer);
    await page.goto(`/products/${product.slug}`);
    await expect(page.getByText("Chỉ khách hàng đã nhận sản phẩm này mới có thể đánh giá.")).toBeVisible();
  });

  test("a customer who received the product posts a review", async ({ page }) => {
    const product = await seedProduct([{ size: "M", stock: 5 }]);
    const customer = await createUser();
    const phone = uniquePhone();
    await setProfilePhone(customer.id, phone);
    const order = await placeOrder({ variantId: product.variants[0].id, phone });
    await deliverOrder(order.id);
    const text = `Vải mát, form chuẩn ${uid()}`;

    await storefrontLogin(page, customer);
    await page.goto(`/products/${product.slug}`);
    await page.getByRole("radiogroup", { name: "Số sao" }).getByRole("radio", { name: "5 sao" }).click();
    await page.getByLabel("Nội dung đánh giá").fill(text);
    await page.getByRole("button", { name: "Gửi đánh giá" }).click();

    await expect(page.getByText(text)).toBeVisible();
    await expect(page.getByRole("img", { name: "5/5 sao" }).first()).toBeVisible();
  });
});
