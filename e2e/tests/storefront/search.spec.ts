import { expect, test } from "../../fixtures/test";
import { seedProduct, uid } from "../../fixtures/data";

// A word no other product contains: letters only, so the 'simple' tsvector keeps it as one token.
const uniqueWord = () => "zq" + uid().replace(/\d/g, (d) => "abcdefghij"[Number(d)]);

// S8. Header suggestions (≥ 2 characters, debounced) and the /search results page.
test("S8 search: suggestion, results page, no-match message", async ({ page }) => {
  const word = uniqueWord();
  const product = await seedProduct([{ size: "M", stock: 5 }], { name: `Áo Thử ${word}` });

  await page.goto("/");
  const box = page.getByRole("combobox", { name: "Tìm sản phẩm" }).first();
  await box.fill(word);
  const suggestions = page.getByRole("listbox", { name: "Gợi ý sản phẩm" });
  await expect(suggestions.getByRole("option", { name: new RegExp(product.name) })).toBeVisible();

  await box.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/search\\?q=${word}`));
  await expect(page.getByText(`1 kết quả cho “${word}”`)).toBeVisible();
  await expect(page.locator("main").getByRole("link", { name: new RegExp(product.name) }).first()).toBeVisible();

  const nothing = uniqueWord();
  await page.goto(`/search?q=${nothing}`);
  await expect(page.getByText(`Không có sản phẩm nào khớp với “${nothing}”`)).toBeVisible();
});
