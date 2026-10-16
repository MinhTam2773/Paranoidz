import { test } from "node:test";
import assert from "node:assert/strict";
import { createOrderBody, matchWard } from "../../src/lib/spx/order-body.ts";

const sender = { name: "Paranoidz", phone: "0909000000", address: "1 Shop St", ward: "Phường Phú Thạnh", province: "Thành phố Hồ Chí Minh" };
const order = {
  order_number: "PZ-2026-0500",
  recipient_name: "Nguyễn Văn A",
  phone: "0900000001",
  address: "12 Ngõ 3",
  note: "Gọi trước khi giao",
  subtotal: 3_000_000,
  total: 2_722_000,
  items: [{ name: "Paranoid Logo Tee", qty: 2 }, { name: "Eye Logo Cap", qty: 1 }],
};

test("create-order body: COD = total, 300 g per unit, sender pays, pickup slot, 2-level addresses", () => {
  const body = createOrderBody(order, "Thành phố Hà Nội", "Phường Ba Đình", { pickupTime: 1792000000, rangeId: 1 }, sender);
  assert.equal(body.order_id, "PZ-2026-0500");
  assert.deepEqual(body.fulfillment_info, {
    payment_role: 1, cod_collection: 1, cod_amount: 2_722_000, high_value_processing_collection: 1,
    collect_type: 1, pickup_time: 1792000000, pickup_time_range_id: 1,
  });
  assert.equal(body.parcel_info.parcel_weight, 0.9);
  assert.equal(body.parcel_info.parcel_item_quantity, 3);
  assert.equal(body.parcel_info.express_insured_value, 3_000_000);
  assert.equal(body.parcel_info.parcel_item_name, "Paranoid Logo Tee ×2, Eye Logo Cap");
  assert.deepEqual(body.deliver_info, {
    deliver_state: "Thành phố Hà Nội", deliver_city: "Phường Ba Đình", deliver_name: "Nguyễn Văn A",
    deliver_phone: "0900000001", deliver_detail_address: "12 Ngõ 3", deliver_instruction: "Gọi trước khi giao",
    deliver_address_version: 2,
  });
  assert.equal(body.sender_info.sender_city, "Phường Phú Thạnh");
  assert.equal(body.sender_info.sender_address_version, 2);
});

test("create-order body: receiver name cut to SPX's 64 characters (orders placed before checkout's limit)", () => {
  const body = createOrderBody({ ...order, recipient_name: "Nguyễn ".repeat(12) }, "Tỉnh Cao Bằng", "Xã Hòa An", { pickupTime: 1, rangeId: 2 }, sender);
  assert.equal(body.deliver_info.deliver_name.length, 64);
});

test("create-order body: high-value service only from ₫3.000.000 declared value", () => {
  const body = createOrderBody({ ...order, subtotal: 2_999_000, note: null }, "Tỉnh Cao Bằng", "Xã Hòa An", { pickupTime: 1, rangeId: 2 }, sender);
  assert.equal(body.fulfillment_info.high_value_processing_collection, 0);
  assert.equal(body.deliver_info.deliver_instruction, "");
});

test("matchWard: ignores accents, case and the Phường / Xã prefix", () => {
  const wards = ["Phường Phú Thạnh", "Phường Tân Phú", "Xã Hát Môn"];
  assert.equal(matchWard("phu thanh", wards), "Phường Phú Thạnh");
  assert.equal(matchWard("P. Tân Phú", wards), null); // abbreviations aren't guessed
  assert.equal(matchWard("Xã Hát Môn", wards), "Xã Hát Môn");
  assert.equal(matchWard("Hat Mon", wards), "Xã Hát Môn");
  assert.equal(matchWard(null, wards), null);
  assert.equal(matchWard("Bến Nghé", wards), null);
});
