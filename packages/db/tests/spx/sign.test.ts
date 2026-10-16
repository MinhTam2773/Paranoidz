import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSign } from "../../src/spx/sign.ts";

// Test vector from SPX's "API authentication guide" (spx.vn/integration).
test("check-sign matches SPX's documented example", () => {
  const body = '{"user_id":239404781503925,"user_secret":"85f0d570-a265-4d9d-857e-b30aa57c4fbe","service_type":1}';
  assert.equal(
    checkSign(100000, "H25HY53GO4BA2GQ", 1677918414, BigInt(926611981), body),
    "97e21b23940e4ddc96fb4d2474f02425353d2b0e23aee384f3f94c3d0b9ba17d",
  );
});
