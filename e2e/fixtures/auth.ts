import { expect, type Page } from "@playwright/test";

/** Storefront email/password login; waits until the login page is left. */
export async function storefrontLogin(page: Page, user: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Mật khẩu").fill(user.password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}
