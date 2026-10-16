import { expect, test } from "../../fixtures/test";
import { seedProduct } from "../../fixtures/data";

// S1. The listing is ISR (revalidate 60), so a product seeded after the build isn't in it yet:
// the listing step only checks the catalog renders; picking runs on this test's own product.
test("S1 browse: home → listing → product page, pick colour + size", async ({ page }) => {
  const product = await seedProduct([
    { color: "Đen", size: "S", stock: 3 },
    { color: "Đen", size: "M", stock: 0 },
    { color: "Trắng", size: "L", stock: 5, price: 250_000 },
  ]);

  await page.goto("/");
  await expect(page.getByRole("link", { name: /Giỏ hàng/ })).toBeVisible();

  await page.goto("/products");
  const card = page.locator('main a[href^="/products/"]').first();
  await expect(card).toBeVisible();
  await card.click();
  await expect(page).toHaveURL(/\/products\/[^/]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.goto(`/products/${product.slug}`);
  await expect(page.getByRole("heading", { level: 1, name: product.name })).toBeVisible();
  const sizes = page.getByRole("group", { name: "Size" });
  await expect(sizes.getByRole("button", { name: "M", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Chọn size" }).first()).toBeDisabled();

  await sizes.getByRole("button", { name: "S", exact: true }).click();
  await expect(page.getByText("Chỉ còn 3 sản phẩm")).toBeVisible();
  await expect(page.getByText("₫200.000").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Thêm vào giỏ" }).first()).toBeEnabled();

  await page.getByRole("button", { name: "Trắng" }).click();
  await sizes.getByRole("button", { name: "L", exact: true }).click();
  await expect(page.getByText("₫250.000").first()).toBeVisible();
});

// S13 (regression, 2026-10-16). The header's backdrop-blur made it the containing block for the
// mobile menu's `fixed inset-0`: closed, the off-screen panel widened the page to 750 px (taps
// landed off target — the mobile S3 timeout); open, the menu was only header-tall.
test("S13 mobile: no sideways scroll, the open menu covers the screen @mobile", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone layout only");
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);

  await page.getByRole("button", { name: "Mở menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu).toBeVisible();
  await expect.poll(async () => (await menu.boundingBox())?.height).toBe(812);
});
