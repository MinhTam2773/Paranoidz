import { test } from "node:test";
import assert from "node:assert/strict";
import { thumbPath } from "../src/thumbs.ts";

const id = "0b2c1bf8-5e19-40cb-8e7a-229ee4fe90bf";

test("thumbPath: a gallery photo path gets its thumbs/ sibling, always .jpg", () => {
  assert.equal(thumbPath(`products/balo-0908/${id}.jpg`, 600), `products/balo-0908/thumbs/${id}-600.jpg`);
  assert.equal(thumbPath(`products/balo-0908/${id}.png`, 120), `products/balo-0908/thumbs/${id}-120.jpg`);
});

test("thumbPath: works on the public URL too", () => {
  const url = `https://x.supabase.co/storage/v1/object/public/product-images/products/balo-0908/${id}.webp`;
  assert.equal(thumbPath(url, 600), `https://x.supabase.co/storage/v1/object/public/product-images/products/balo-0908/thumbs/${id}-600.jpg`);
});

test("thumbPath: anything else comes back unchanged", () => {
  assert.equal(thumbPath("seed/shirt-1.jpg", 600), "seed/shirt-1.jpg");
  assert.equal(thumbPath(`products/x/video/${id}.mp4`, 120), `products/x/video/${id}.mp4`);
});
