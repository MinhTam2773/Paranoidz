import { test } from "node:test";
import assert from "node:assert/strict";
import { ORDER_ACTIONS } from "../src/lib/order-status.ts";
import { planShipments, type BulkOrder } from "../src/lib/spx-bulk.ts";

test("a pending order can only be cancelled: creating the SPX shipment confirms it", () => {
  assert.equal(ORDER_ACTIONS.pending.primary, undefined);
  assert.deepEqual(ORDER_ACTIONS.pending.secondary.map((a) => a.to), ["cancelled"]);
});

const order = (n: number, over: Partial<BulkOrder> = {}): BulkOrder =>
  ({ id: `id${n}`, order_number: `PZ-2026-000${n}`, status: "pending", spx_tracking_no: null, city: "TP. Hồ Chí Minh", ward: "Phường Phú Thạnh", ...over });

test("planShipments matches wards and skips what can't be created in bulk", () => {
  const wards = new Map([["Thành phố Hồ Chí Minh", ["Phường Phú Thạnh", "Phường Tân Phú"]]]);
  const { ready, skipped } = planShipments(
    [
      order(1),
      order(2, { ward: "tan phu" }), // typed before the picker: accents / prefix ignored
      order(3, { ward: "Phường Không Có" }),
      order(4, { spx_tracking_no: "SPXVN1" }),
      order(5, { status: "cancelled" }),
      order(6, { city: "Hà Nội", ward: "Phường Ba Đình" }), // no wards loaded for that province
    ],
    wards,
  );
  assert.deepEqual(ready, [
    { id: "id1", orderNumber: "PZ-2026-0001", ward: "Phường Phú Thạnh" },
    { id: "id2", orderNumber: "PZ-2026-0002", ward: "Phường Tân Phú" },
  ]);
  assert.deepEqual(skipped.map((s) => s.orderNumber), ["PZ-2026-0003", "PZ-2026-0004", "PZ-2026-0005", "PZ-2026-0006"]);
});
