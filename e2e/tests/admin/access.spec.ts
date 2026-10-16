import { expect, test } from "@playwright/test";
import { ADMIN_STATE, ADMIN_URL } from "../../env";
import { createUser } from "../../fixtures/data";

// A1. The proxy gate: no session → /login; a signed-in non-admin is signed out and refused.
test.describe("A1 admin access", () => {
  test.use({ baseURL: ADMIN_URL });

  test("signed out → login page", async ({ page }) => {
    await page.goto("/orders");
    await expect(page).toHaveURL(`${ADMIN_URL}/login`);
  });

  test("a customer account is refused", async ({ page }) => {
    const customer = await createUser();
    await page.goto("/login");
    await page.getByLabel("Email").fill(customer.email);
    await page.getByLabel("Mật khẩu").fill(customer.password);
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await expect(page).toHaveURL(`${ADMIN_URL}/login?notice=forbidden`);
    await expect(page.getByText("Tài khoản này không có quyền quản trị.")).toBeVisible();
  });

  test.describe("as the admin", () => {
    test.use({ storageState: ADMIN_STATE });

    test("gets in", async ({ page }) => {
      await page.goto("/orders");
      await expect(page).toHaveURL(`${ADMIN_URL}/orders`);
      await expect(page.getByRole("heading", { level: 1, name: "Đơn hàng" })).toBeVisible();
    });
  });
});
