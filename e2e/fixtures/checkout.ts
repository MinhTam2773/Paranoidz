import { expect, type Page } from "@playwright/test";
import { CITY } from "./data";

// Same as apps/storefront/src/lib/format.ts: 269000 → "₫269.000".
export const vnd = (amount: number) => "₫" + String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** Fills the checkout delivery form; the province goes through the searchable picker. */
export async function fillDelivery(page: Page, { phone, name = "Khách Hàng Thử" }: { phone: string; name?: string }) {
  // By id: "Số điện thoại" / "Địa chỉ" are also prefixes of other labels on the page.
  await page.locator("#checkout-name").fill(name);
  await page.locator("#checkout-phone").fill(phone);
  await page.locator("#checkout-address").fill("1 Lê Lợi");
  await page.locator("#checkout-ward").fill("Phường Bến Thành");
  await page.locator("#checkout-city").click();
  await page.getByRole("combobox", { name: "Tìm tỉnh / thành phố" }).fill("Hồ Chí Minh");
  await page.getByRole("option", { name: CITY }).click();
  await expect(page.locator("#checkout-city")).toContainText(CITY);
}

export const placeOrderButton = (page: Page) => page.getByRole("button", { name: "Đặt hàng" });

/** Reads the order number from the success screen. */
export async function placedOrderNumber(page: Page) {
  await expect(page.getByRole("heading", { name: "Cảm ơn bạn — đã đặt hàng thành công" })).toBeVisible();
  const number = await page.getByRole("status").locator("strong").first().textContent();
  expect(number).toMatch(/^PZ-\d{4}-\d{4}$/);
  return number!;
}
