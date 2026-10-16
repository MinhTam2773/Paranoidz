import { expect, test as setup } from "@playwright/test";
import { ADMIN_STATE, ADMIN_URL } from "../env";
import { createUser } from "../fixtures/data";

// One admin for the run, signed in through the real login form. The password lives only in
// memory; the admin tests reuse the saved session.
setup("admin session", async ({ page }) => {
  const admin = await createUser({ admin: true });
  await page.goto(`${ADMIN_URL}/login`);
  await page.getByLabel("Email").fill(admin.email);
  await page.getByLabel("Mật khẩu").fill(admin.password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(`${ADMIN_URL}/`);
  await page.context().storageState({ path: ADMIN_STATE });
});
