import { searchKey } from "@paranoidz/db/provinces";

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
      deliver_name: order.recipient_name,
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

// The SPX ward matching what the customer typed, ignoring accents, case and the
// "Phường" / "Xã" / "Đặc khu" prefix; null when nothing matches exactly.
export function matchWard(typed: string | null, wards: string[]) {
  if (!typed) return null;
  const key = (s: string) => searchKey(s).replace(/^(phuong|xa|dac khu) /, "");
  return wards.find((w) => key(w) === key(typed)) ?? null;
}
