import { expect, test } from "../../fixtures/test";
import { storefrontLogin } from "../../fixtures/auth";
import { createUser, db, setProfilePhone, uid, uniquePhone } from "../../fixtures/data";
import { authLinkFromEmail } from "../../fixtures/mail";

// S11. Forgot password → reset email → link signs in on
// /account/password → the new password works.
test("S11 password reset: email link → new password → log in with it", async ({ page, browser }) => {
  const customer = await createUser();
  await setProfilePhone(customer.id, uniquePhone());
  const newPassword = `Moi-${uid()}-${uid()}`;

  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(customer.email);
  await page.getByRole("button", { name: "Gửi liên kết đặt lại" }).click();
  await expect(page.getByRole("status").filter({ hasText: customer.email })).toBeVisible();

  await page.goto(await authLinkFromEmail(customer.email, "recovery"));
  await expect(page).toHaveURL(/\/account\/password/);
  await page.getByLabel("Mật khẩu mới").fill(newPassword);
  await page.getByRole("button", { name: "Đổi mật khẩu" }).click();
  await expect(page.getByRole("status")).toBeVisible();

  const fresh = await browser.newPage({ baseURL: page.url().replace(/\/account.*$/, "") });
  await storefrontLogin(fresh, { email: customer.email, password: newPassword });
  await fresh.close();
});

// S12. Sign-up needs the emailed confirmation (on, as in production) before the account works.
test("S12 sign-up: confirmation email confirms the account", async ({ page }) => {
  const email = `e2e-${uid()}@paranoidz.test`;

  await page.goto("/register");
  await page.getByLabel("Họ tên").fill("Khách Hàng Mới");
  await page.getByLabel("Số điện thoại").fill(uniquePhone());
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(`Pz-${uid()}-${uid()}`);
  await page.getByRole("button", { name: "Tạo tài khoản" }).click();
  await expect(page.getByRole("heading", { name: "Kiểm tra email của bạn" })).toBeVisible();

  await page.goto(await authLinkFromEmail(email, "signup"));
  await expect(page).toHaveURL(/\/account/);
  await expect(page).not.toHaveURL(/\/login/);

  const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
  expect(data.users.find((u) => u.email === email)?.email_confirmed_at).toBeTruthy();
});
