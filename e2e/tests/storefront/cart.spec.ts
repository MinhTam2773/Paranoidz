import { expect, test } from "@playwright/test";
import { seedProduct } from "../../fixtures/data";

// S2. Guest cart: localStorage-backed, survives a reload, header badge follows it.
test("S2 cart: add, change quantity, reload, remove", async ({ page }) => {
  const product = await seedProduct([{ size: "M", stock: 5 }]);
  const cartLink = page.getByRole("link", { name: /^Giỏ hàng, \d+ sản phẩm$/ });

  await page.goto(`/products/${product.slug}`);
  await page.getByRole("group", { name: "Size" }).getByRole("button", { name: "M", exact: true }).click();
  await page.getByRole("button", { name: "Thêm vào giỏ" }).first().click();
  await expect(page.getByText("Đã thêm vào giỏ").first()).toBeVisible();
  await expect(cartLink).toHaveAccessibleName("Giỏ hàng, 1 sản phẩm");

  await page.goto("/cart");
  await expect(page.getByRole("link", { name: product.name })).toBeVisible();
  await page.getByRole("group", { name: `Số lượng ${product.name}` }).getByRole("button", { name: "Tăng số lượng" }).click();
  await expect(cartLink).toHaveAccessibleName("Giỏ hàng, 2 sản phẩm");
  await expect(page.getByText("₫400.000").first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole("group", { name: `Số lượng ${product.name}` })).toContainText("2");
  await expect(cartLink).toHaveAccessibleName("Giỏ hàng, 2 sản phẩm");

  await page.getByRole("button", { name: `Xóa ${product.name} (Đen / M)` }).click();
  await expect(page.getByText("Giỏ hàng của bạn đang trống.")).toBeVisible();
  await expect(cartLink).toHaveAccessibleName("Giỏ hàng, 0 sản phẩm");
});
