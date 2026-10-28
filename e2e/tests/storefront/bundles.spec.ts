import { expect, test } from "../../fixtures/test";
import { fillDelivery, placedOrderNumber, placeOrderButton } from "../../fixtures/checkout";
import { createBundle, db, seedProduct, uniquePhone } from "../../fixtures/data";

// S9. Pricing v2: the combo comes off first, then "Khách mua lần đầu" 10% on the rest (they stack).
// 2 × ₫200.000: combo −₫50.000, then 10% of ₫350.000 = −₫35.000 → −₫85.000.
test("S9 bundle: offer on the product page, combo discount at checkout and on the order", async ({ page }) => {
  const tee = await seedProduct([{ size: "M", stock: 5 }]);
  const cap = await seedProduct([{ size: "FREE", stock: 5 }]);
  const bundle = await createBundle([tee.id, cap.id], 50_000);

  await page.goto(`/products/${tee.slug}`);
  const offers = page.getByRole("region", { name: "Mua theo combo" });
  await expect(offers.getByText(bundle.name)).toBeVisible();

  for (const p of [tee, cap]) {
    await page.goto(`/products/${p.slug}`);
    const size = p.variants[0].size;
    // A single in-stock size (FREE) is preselected; otherwise pick it.
    if (size !== "FREE") await page.getByRole("group", { name: "Size" }).getByRole("button", { name: size, exact: true }).click();
    await page.getByRole("button", { name: "Thêm vào giỏ" }).first().click();
    await expect(page.getByText("Đã thêm vào giỏ").first()).toBeVisible();
  }

  await page.goto("/checkout");
  await fillDelivery(page, { phone: uniquePhone() });
  // Today's checkout shows one discount label (the codes); the amount is combo + codes.
  await expect(page.getByText("−₫85.000")).toBeVisible();

  await placeOrderButton(page).click();
  const number = await placedOrderNumber(page);
  const { data: order } = await db.from("orders").select("discount, applied_bundles").eq("order_number", number).single();
  expect(order?.discount).toBe(85_000);
  expect(order?.applied_bundles).toEqual([expect.objectContaining({ bundle_id: bundle.id, sets: 1 })]);
});
