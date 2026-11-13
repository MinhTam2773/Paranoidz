import { test } from "node:test";
import assert from "node:assert/strict";
import { RETURN_STEPS, suggestedRefund } from "../src/lib/returns.ts";

const order = {
  lines: [
    { price: 200_000, qty: 2, isGift: false },
    { price: 100_000, qty: 1, isGift: false },
    { price: 0, qty: 1, isGift: true },
  ],
  discount: 50_000, // 10 % of 500.000
  gachaDiscount: 0,
};

test("suggested refund: price paid minus the pro-rata code discount", () => {
  assert.equal(suggestedRefund(order, [{ price: 200_000, qty: 1 }]), 180_000);
  assert.equal(suggestedRefund(order, [{ price: 200_000, qty: 2 }, { price: 100_000, qty: 1 }]), 450_000);
  assert.equal(suggestedRefund({ ...order, gachaDiscount: 25_000 }, [{ price: 100_000, qty: 1 }]), 85_000);
  assert.equal(suggestedRefund(order, []), 0);
});

test("finished returns offer no step", () => {
  assert.deepEqual([RETURN_STEPS.refunded, RETURN_STEPS.rejected, RETURN_STEPS.cancelled], [[], [], []]);
  assert.ok(RETURN_STEPS.received.includes("refund"));
});
