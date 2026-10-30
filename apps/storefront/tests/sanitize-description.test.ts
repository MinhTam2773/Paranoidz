import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeDescriptionHtml } from "../src/lib/sanitize-description.ts";

const SRC = "https://x.supabase.co/storage/v1/object/public/product-images/products/a/desc/b.jpg";

test("img keeps numeric width / height from the admin uploader", () => {
  assert.equal(
    sanitizeDescriptionHtml(`<img src="${SRC}" alt="" width="1600" height="2501">`),
    `<img src="${SRC}" alt="" width="1600" height="2501" loading="lazy" decoding="async">`,
  );
});

test("img drops width / height that are not plain numbers", () => {
  assert.equal(
    sanitizeDescriptionHtml(`<img src="${SRC}" width="100%" height="1 onerror=alert(1)">`),
    `<img src="${SRC}" loading="lazy" decoding="async">`,
  );
});
