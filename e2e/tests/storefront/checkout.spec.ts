import { expect, test } from "@playwright/test";
import { fillDelivery, placedOrderNumber, placeOrderButton, vnd } from "../../fixtures/checkout";
import { CITY, createPromo, db, placeOrder, seedProduct, uniquePhone, variantStock } from "../../fixtures/data";

async function shippingFee(units: number) {
  const { data, error } = await db.rpc("shipping_fee", { p_city: CITY, p_units: units });
  if (error) throw error;
  return Number(data);
}

async function orderByNumber(number: string) {
  const { data, error } = await db.from("orders").select("id, status, subtotal, discount, shipping_fee, total").eq("order_number", number).single();
  if (error) throw error;
  return data;
}

// S3 (also run at 375 px). Cart → checkout → order; the DB holds a pending order whose money
// was computed server-side, and stock went down.
test("S3 guest checkout: cart → order placed, priced server-side @mobile", async ({ page }) => {
  const product = await seedProduct([{ size: "M", stock: 5, price: 200_000 }]);
  const variant = product.variants[0];
  const fee = await shippingFee(1);

  await page.goto(`/products/${product.slug}`);
  await page.getByRole("group", { name: "Size" }).getByRole("button", { name: "M", exact: true }).click();
  await page.getByRole("button", { name: "Thêm vào giỏ" }).first().click();
  await expect(page.getByText("Đã thêm vào giỏ").first()).toBeVisible();

  await page.goto("/checkout");
  await fillDelivery(page, { phone: uniquePhone() });
  await expect(page.getByText("Ưu đãi 5 đơn đầu (−10%)")).toBeVisible();
  await expect(page.getByText("−₫20.000")).toBeVisible();
  await expect(page.getByText(vnd(200_000 - 20_000 + fee))).toBeVisible();

  await placeOrderButton(page).click();
  const number = await placedOrderNumber(page);

  const order = await orderByNumber(number);
  expect(order).toMatchObject({ status: "pending", subtotal: 200_000, discount: 20_000, shipping_fee: fee, total: 200_000 - 20_000 + fee });
  expect(await variantStock(variant.id)).toBe(4);
  await expect(page.getByRole("link", { name: /^Giỏ hàng, \d+ sản phẩm$/ })).toHaveAccessibleName("Giỏ hàng, 0 sản phẩm");
});

// S4. A better promo replaces the first-5 discount; a bad code shows the error and prices without it.
test("S4 promo code: invalid → error, valid → lower total, honoured by the order", async ({ page }) => {
  const product = await seedProduct([{ size: "M", stock: 5, price: 200_000 }]);
  const code = await createPromo(20);

  await page.goto(`/checkout?variant=${product.variants[0].id}&qty=1`);
  await fillDelivery(page, { phone: uniquePhone() });
  const voucher = page.getByLabel("Mã giảm giá");

  await voucher.fill("E2EKHONGTONTAI");
  await expect(page.getByText("Mã không hợp lệ hoặc đã hết hạn.")).toBeVisible();
  await expect(page.getByText("Ưu đãi 5 đơn đầu (−10%)")).toBeVisible();

  await voucher.fill(code);
  await expect(page.getByText(`Mã ${code} (−20%)`)).toBeVisible();
  await expect(page.getByText("−₫40.000")).toBeVisible();

  await placeOrderButton(page).click();
  const order = await orderByNumber(await placedOrderNumber(page));
  expect(order.discount).toBe(40_000);
  const { data: promo } = await db.from("vouchers").select("used_count").eq("code", code).single();
  expect(promo?.used_count).toBe(1);
});

test.describe("S5 checkout guards", () => {
  test("missing fields and a bad phone show Vietnamese errors", async ({ page }) => {
    const product = await seedProduct([{ size: "M", stock: 5 }]);
    await page.goto(`/checkout?variant=${product.variants[0].id}&qty=1`);
    await expect(placeOrderButton(page)).toBeEnabled();

    await placeOrderButton(page).click();
    for (const message of [
      "Nhập họ tên người nhận.",
      "Nhập số điện thoại để chúng tôi xác nhận đơn hàng.",
      "Nhập số nhà và tên đường.",
      "Nhập phường hoặc xã.",
      "Chọn tỉnh / thành phố.",
    ]) {
      await expect(page.getByText(message)).toBeVisible();
    }

    await fillDelivery(page, { phone: "0123456789" });
    await placeOrderButton(page).click();
    await expect(page.getByText("Nhập số di động Việt Nam: 10 chữ số, bắt đầu bằng 03, 05, 07, 08 hoặc 09.")).toBeVisible();
  });

  test("stock sold out after the page loaded → refused, stock never negative", async ({ page }) => {
    const product = await seedProduct([{ size: "M", stock: 2 }]);
    const variant = product.variants[0];
    const phone = uniquePhone();

    await page.goto(`/checkout?variant=${variant.id}&qty=2`);
    await fillDelivery(page, { phone });
    await placeOrder({ variantId: variant.id, qty: 2 }); // someone else buys the last 2 first
    expect(await variantStock(variant.id)).toBe(0);

    await placeOrderButton(page).click();
    await expect(page.getByRole("alert").filter({ hasText: "Một số sản phẩm vừa hết hàng hoặc không còn bán. Vui lòng kiểm tra lại giỏ hàng." })).toBeVisible();
    expect(await variantStock(variant.id)).toBe(0);
    const { count } = await db.from("orders").select("id", { count: "exact", head: true }).eq("phone", phone);
    expect(count).toBe(0);
  });
});

// S6. Guest lookup by order number + phone; a wrong phone finds nothing.
test("S6 order lookup: wrong phone → not found, right phone → status", async ({ page }) => {
  const product = await seedProduct([{ size: "M", stock: 5 }]);
  const order = await placeOrder({ variantId: product.variants[0].id });

  await page.goto("/order-lookup");
  await page.getByLabel("Mã đơn hàng").fill(order.number);
  await page.getByLabel("Số điện thoại").fill(uniquePhone());
  await page.getByRole("button", { name: "Tra cứu đơn hàng" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Không tìm thấy đơn hàng" })).toBeVisible();

  await page.getByLabel("Số điện thoại").fill(order.phone);
  await page.getByRole("button", { name: "Tra cứu đơn hàng" }).click();
  await expect(page.getByRole("heading", { name: "Chờ xác nhận" })).toBeVisible();
});
