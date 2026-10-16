// Bulk "TẠO ĐƠN SPX & IN PHIẾU" on /orders: which ticked orders can get a shipment, and with which ward.
import { PROVINCES } from "@paranoidz/db/provinces";
import { matchWard } from "@paranoidz/db/spx/order-body";

export const BULK_LIMIT = 20;

export type BulkOrder = { id: string; order_number: string; status: string; spx_tracking_no: string | null; city: string; ward: string | null };
export type BulkFailure = { orderNumber: string; reason: string };

export function spxProvince(city: string) {
  return PROVINCES.find((p) => p.name === city)?.spx ?? "";
}

// `wards`: SPX's ward list per SPX province name. A typed ward from before the checkout
// picker may not match; that order is skipped and created from its own page.
export function planShipments(orders: BulkOrder[], wards: Map<string, string[]>) {
  const ready: { id: string; orderNumber: string; ward: string }[] = [];
  const skipped: BulkFailure[] = [];
  for (const o of orders) {
    if (o.spx_tracking_no || o.status !== "pending") {
      skipped.push({ orderNumber: o.order_number, reason: "Đơn đã có vận đơn hoặc không còn ở trạng thái Đã tiếp nhận." });
      continue;
    }
    const ward = matchWard(o.ward, wards.get(spxProvince(o.city)) ?? []);
    if (ward) ready.push({ id: o.id, orderNumber: o.order_number, ward });
    else skipped.push({ orderNumber: o.order_number, reason: "Không khớp phường / xã SPX — tạo ở trang đơn." });
  }
  return { ready, skipped };
}
