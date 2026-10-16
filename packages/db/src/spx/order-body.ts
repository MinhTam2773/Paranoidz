import { searchKey } from "../provinces.ts";

// One order for SPX's 1.2 Create Order (ARCHITECTURE.md §5 "SPX Open API"): standard service,
// pickup, sender pays shipping, COD = the order total, 300 g per unit (same as shipping_fee()),
// declared value = subtotal with SPX's high-value service from ₫3.000.000. Addresses are SPX's
// 2-level names (address_version 2): state = province, city = ward.
const UNIT_GRAMS = 300;
const HIGH_VALUE = 3_000_000;

export type SpxSender = { name: string; phone: string; address: string; ward: string; province: string };
export type SpxPickup = { pickupTime: number; rangeId: number };
type Order = {
  order_number: string;
  recipient_name: string;
  phone: string;
  address: string;
  note: string | null;
  subtotal: number;
  total: number;
  items: { name: string; qty: number }[];
};

export function createOrderBody(order: Order, province: string, ward: string, pickup: SpxPickup, sender: SpxSender) {
  const units = order.items.reduce((sum, i) => sum + i.qty, 0);
  return {
    order_id: order.order_number,
    base_info: { service_type: 1 },
    sender_info: {
      sender_state: sender.province,
      sender_city: sender.ward,
      sender_name: sender.name,
      sender_phone: sender.phone,
      sender_detail_address: sender.address,
      sender_address_version: 2,
    },
    fulfillment_info: {
      payment_role: 1,
      cod_collection: 1,
      cod_amount: order.total,
      high_value_processing_collection: order.subtotal >= HIGH_VALUE ? 1 : 0,
      collect_type: 1,
      pickup_time: pickup.pickupTime,
      pickup_time_range_id: pickup.rangeId,
    },
    deliver_info: {
      deliver_state: province,
      deliver_city: ward,
      deliver_name: order.recipient_name.slice(0, 64), // SPX's limit; checkout caps new names at 64 too
      deliver_phone: order.phone,
      deliver_detail_address: order.address,
      deliver_instruction: (order.note ?? "").slice(0, 256),
      deliver_address_version: 2,
    },
    parcel_info: {
      parcel_weight: (units * UNIT_GRAMS) / 1000,
      parcel_item_name: order.items.map((i) => (i.qty > 1 ? `${i.name} ×${i.qty}` : i.name)).join(", ").slice(0, 256),
      parcel_item_quantity: units,
      express_insured_value: order.subtotal,
    },
  };
}

// One row for SPX's 2.1 Check Shipping Fee: the parcel createOrderBody() will send, priced
// before the order exists. `value` stands in for both COD amount and declared value (the
// checkout's subtotal: the total isn't known until the fee is). `id` maps the answer back.
export function checkOrderBody(id: string, province: string, ward: string, units: number, value: number, sender: Pick<SpxSender, "province" | "ward">, voucher?: string) {
  return {
    order_id: id,
    base_info: { service_type: 1 },
    sender_info: { sender_state: sender.province, sender_city: sender.ward, sender_address_version: 2 },
    fulfillment_info: {
      cod_collection: 1,
      cod_amount: value,
      high_value_processing_collection: value >= HIGH_VALUE ? 1 : 0,
      collect_type: 1,
      ...(voucher ? { voucher_code: voucher } : {}),
    },
    deliver_info: { deliver_state: province, deliver_city: ward, deliver_address_version: 2 },
    parcel_info: { parcel_weight: (units * UNIT_GRAMS) / 1000, parcel_item_quantity: units, express_insured_value: value },
  };
}

// The cheapest of 2.1's answers, rounded to whole đồng; a tie goes to no voucher. `voucherOf`
// maps a row's order_id to the voucher code it was priced with (null = none).
export function cheapestQuote(rows: { order_id: string; estimated_shipping_fee: number }[], voucherOf: (id: string) => string | null) {
  let best: { fee: number; voucherCode: string | null } | null = null;
  for (const row of rows) {
    const fee = Math.round(row.estimated_shipping_fee);
    if (!Number.isFinite(fee) || fee < 0) continue;
    const voucherCode = voucherOf(row.order_id);
    if (!best || fee < best.fee || (fee === best.fee && !voucherCode)) best = { fee, voucherCode };
  }
  return best;
}

// The SPX ward matching what the customer typed, ignoring accents, case and the
// "Phường" / "Xã" / "Đặc khu" prefix; null when nothing matches exactly.
export function matchWard(typed: string | null, wards: string[]) {
  if (!typed) return null;
  const key = (s: string) => searchKey(s).replace(/^(phuong|xa|dac khu) /, "");
  return wards.find((w) => key(w) === key(typed)) ?? null;
}
