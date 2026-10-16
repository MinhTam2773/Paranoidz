import { expect, test } from "../../fixtures/test";
import { fillDelivery, placedOrderNumber, placeOrderButton } from "../../fixtures/checkout";
import { createUser, seedProduct, uniquePhone } from "../../fixtures/data";

// S7. An order placed while signed in shows up in the account's order history.
test("S7 signed-in customer: order appears in /account history", async ({ page }) => {
  const product = await seedProduct([{ size: "M", stock: 5 }]);
  const customer = await createUser();
  const phone = uniquePhone();

  await page.goto("/login");
  await page.getByLabel("Email").fill(customer.email);
  await page.getByLabel("Mật khẩu").fill(customer.password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  // An account needs a phone before /account opens (every per-customer rule keys on it).
  await expect(page.getByRole("heading", { name: "Thêm số điện thoại" })).toBeVisible();
  await page.getByLabel("Số điện thoại").fill(phone);
  await page.getByRole("button", { name: "Lưu và tiếp tục" }).click();
  await expect(page).not.toHaveURL(/\/account\/phone/);

  await page.goto(`/checkout?variant=${product.variants[0].id}&qty=1`);
  await fillDelivery(page, { phone });
  await placeOrderButton(page).click();
  const number = await placedOrderNumber(page);

  await page.goto("/account");
  const history = page.getByRole("region", { name: "Lịch sử đơn hàng" });
  await expect(history.getByText(number)).toBeVisible();
  await expect(history.getByText("Đã tiếp nhận").first()).toBeVisible();
});
