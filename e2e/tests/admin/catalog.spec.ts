import { expect, test } from "@playwright/test";
import { ADMIN_STATE, ADMIN_URL, STOREFRONT_URL } from "../../env";
import { seedProduct, uid, variantStock } from "../../fixtures/data";

test.use({ baseURL: ADMIN_URL, storageState: ADMIN_STATE });

// A4. A product created in the admin renders on the storefront. Its own page, not /products:
// the listing is ISR (revalidate 60) and the admin can't revalidate the storefront's cache.
test("A4 create a product → it renders on the storefront", async ({ page }) => {
  const name = `Áo Thử Tạo ${uid()}`;

  await page.goto("/products/new");
  await page.locator("#name").fill(name);
  const slug = await page.locator("#slug").inputValue();
  expect(slug).not.toBe("");
  await page.getByLabel("Đang bán (hiển thị trên cửa hàng)").check();
  await page.locator("#matrix-colors").fill("Đen");
  await page.locator("#matrix-sizes").fill("M");
  await page.getByRole("button", { name: "Thêm biến thể" }).click();
  await page.locator('[id="variants.0.price"]').fill("250000");
  await page.locator('[id="variants.0.stock"]').fill("7");
  await page.locator('[id="variants.0.sku"]').fill(`E2E-${uid()}`.toUpperCase());
  await page.getByRole("button", { name: "Tạo sản phẩm" }).click();
  await expect(page).toHaveURL(new RegExp(`${ADMIN_URL}/products/[0-9a-f-]{36}$`));

  await page.goto(`${STOREFRONT_URL}/products/${slug}`);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByText("₫250.000").first()).toBeVisible();
});

// A5. − / + / Lưu on the inventory page → adjust_variant_stock(); never below 0.
test("A5 inventory adjust: can't go below 0, +1 saves", async ({ page }) => {
  const product = await seedProduct([{ size: "M", stock: 2 }]);
  const { id, sku } = product.variants[0];

  await page.goto(`/inventory?q=${sku}`);
  const row = page.getByRole("row").filter({ hasText: sku! });
  const save = row.getByRole("button", { name: "Lưu" });
  const amount = row.getByLabel(`Số lượng điều chỉnh cho ${sku}`);

  for (let i = 0; i < 3; i++) await row.getByRole("button", { name: `Giảm ${sku}` }).click();
  await expect(amount).toHaveValue("-3");
  await expect(save).toBeDisabled();

  for (let i = 0; i < 4; i++) await row.getByRole("button", { name: `Tăng ${sku}` }).click();
  await expect(amount).toHaveValue("1");
  await save.click();
  await expect(page.getByRole("status").filter({ hasText: `${sku}: +1 → tồn kho 3` })).toBeVisible();
  expect(await variantStock(id)).toBe(3);
});
