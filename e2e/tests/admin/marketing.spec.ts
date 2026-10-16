import { expect, test } from "../../fixtures/test";
import { ADMIN_STATE, ADMIN_URL, STOREFRONT_URL } from "../../env";
import { db, seedProduct, uid, uniquePhone } from "../../fixtures/data";

// Admin-made promos, collections and bundles, checked where customers see them.
test.use({ baseURL: ADMIN_URL, storageState: ADMIN_STATE });

// A6. Created → prices at checkout; switched off → refused.
test("A6 promo code: create → applies at checkout, deactivate → refused", async ({ page }) => {
  const product = await seedProduct([{ size: "M", stock: 5, price: 200_000 }]);
  const code = `E2E${uid()}`.toUpperCase();

  await page.goto("/promo-codes/new");
  await page.getByLabel("Mã", { exact: true }).fill(code);
  await page.getByLabel("Giảm (%)").fill("15");
  await page.getByRole("button", { name: "Tạo mã" }).click();
  await expect(page).toHaveURL(`${ADMIN_URL}/promo-codes`);

  const checkout = `${STOREFRONT_URL}/checkout?variant=${product.variants[0].id}&qty=1`;
  const phone = uniquePhone();
  await page.goto(checkout);
  await page.locator("#checkout-phone").fill(phone);
  await page.getByLabel("Mã giảm giá").fill(code);
  await expect(page.getByText(`Mã ${code} (−15%)`)).toBeVisible();

  await page.goto("/promo-codes");
  const toggle = page.getByRole("switch", { name: `Đang bật: ${code}` });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  const { data } = await db.from("vouchers").select("is_active").eq("code", code).single();
  expect(data?.is_active).toBe(false);

  await page.goto(checkout);
  await page.locator("#checkout-phone").fill(phone);
  await page.getByLabel("Mã giảm giá").fill(code);
  await expect(page.getByText("Mã không hợp lệ hoặc đã hết hạn.")).toBeVisible();
});

// A7. A new collection page renders on first visit (ISR builds unseen slugs on demand).
test("A7 collection: create with a product → storefront collection page", async ({ page }) => {
  const product = await seedProduct([{ size: "M", stock: 5 }]);
  const name = `Bộ Sưu Tập Thử ${uid()}`;

  await page.goto("/collections/new");
  await page.getByLabel("Tên bộ sưu tập").fill(name);
  const slug = await page.getByLabel("Đường dẫn (slug)").inputValue();
  await page.getByLabel("Hiển thị trên cửa hàng").check();
  await page.getByLabel("Thêm sản phẩm").fill(product.name);
  await page.getByRole("listitem").filter({ hasText: product.name }).getByRole("button", { name: "Thêm" }).click();
  await page.getByRole("button", { name: "Tạo bộ sưu tập" }).click();
  await expect(page).toHaveURL(new RegExp(`${ADMIN_URL}/collections/[0-9a-f-]{36}$`));

  await page.goto(`${STOREFRONT_URL}/collections/${slug}`);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.locator("main").getByRole("link", { name: new RegExp(product.name) }).first()).toBeVisible();
});

// A8. The bundle editor's combo shows up on the products' pages.
test("A8 bundle: create in admin → offer on the storefront product page", async ({ page }) => {
  const tee = await seedProduct([{ size: "M", stock: 5 }]);
  const cap = await seedProduct([{ size: "FREE", stock: 5 }]);
  const name = `Combo Admin ${uid()}`;

  await page.goto("/bundles/new");
  await page.getByLabel("Tên combo").fill(name);
  await page.getByLabel("Giảm mỗi combo (₫)").fill("30000");
  for (const p of [tee, cap]) {
    await page.getByLabel("Thêm sản phẩm").fill(p.name);
    await page.getByRole("button", { name: `Thêm ${p.name}` }).click();
  }
  await page.getByRole("button", { name: "Tạo combo" }).click();
  await expect(page).toHaveURL(new RegExp(`${ADMIN_URL}/bundles/[0-9a-f-]{36}$`));

  await page.goto(`${STOREFRONT_URL}/products/${cap.slug}`);
  await expect(page.getByRole("region", { name: "Mua theo combo" }).getByText(name)).toBeVisible();
});
