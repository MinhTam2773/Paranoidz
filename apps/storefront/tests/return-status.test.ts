import { test } from "node:test";
import assert from "node:assert/strict";
import { canRequestReturn, returnableQty, returnDeadline } from "../src/lib/return-status.ts";

// Mirrors request_return() (migration 20261113000001): 7 days from delivery, no gift lines,
// quantities held by live requests, one open request at a time.
const lines = [
  { id: "a", qty: 2, isGift: false },
  { id: "b", qty: 1, isGift: false },
  { id: "gift", qty: 1, isGift: true },
];
const deliveredAt = "2026-11-10T03:00:00.000Z";

test("returnable: gift lines never, rejected / cancelled requests free their units", () => {
  assert.deepEqual(returnableQty(lines, []), { a: 2, b: 1, gift: 0 });
  assert.deepEqual(
    returnableQty(lines, [
      { status: "refunded", items: [{ orderItemId: "a", qty: 1 }] },
      { status: "rejected", items: [{ orderItemId: "b", qty: 1 }] },
      { status: "cancelled", items: [{ orderItemId: "a", qty: 1 }] },
    ]),
    { a: 1, b: 1, gift: 0 },
  );
});

test("deadline is delivery + 7 days", () => {
  assert.equal(returnDeadline(deliveredAt)?.toISOString(), "2026-11-17T03:00:00.000Z");
  assert.equal(returnDeadline(null), null);
});

test("canRequestReturn: delivered, inside the window, nothing open, something left", () => {
  const order = { status: "delivered", deliveredAt, lines, requests: [] };
  assert.equal(canRequestReturn(order, new Date("2026-11-17T02:59:00Z")), true);
  assert.equal(canRequestReturn(order, new Date("2026-11-17T03:01:00Z")), false);
  assert.equal(canRequestReturn({ ...order, status: "shipped", deliveredAt: null }, new Date("2026-11-11T00:00:00Z")), false);
  const open = { status: "requested" as const, items: [{ orderItemId: "a", qty: 1 }] };
  assert.equal(canRequestReturn({ ...order, requests: [open] }, new Date("2026-11-11T00:00:00Z")), false);
  const all = { status: "received" as const, items: [{ orderItemId: "a", qty: 2 }, { orderItemId: "b", qty: 1 }] };
  assert.equal(canRequestReturn({ ...order, requests: [all] }, new Date("2026-11-11T00:00:00Z")), false);
});
