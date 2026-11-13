import type { Database } from "@paranoidz/db/types";
import { HOTLINE } from "./site.ts"; // .ts: also loaded by node --test

// Customer returns (ARCHITECTURE.md §4 "Returns"). The rules below mirror request_return() so the
// lookup page only offers what the database will accept; the database stays the judge.

export type ReturnStatus = Database["public"]["Enums"]["return_status"];
export type ReturnReason = "defect" | "wrong_item" | "not_as_described" | "other";

export const RETURN_DAYS = 7;
export const MAX_RETURN_PHOTOS = 5;
export const MAX_RETURN_PHOTO_BYTES = 5 * 1024 * 1024; // the return-images bucket's limit
export const RETURN_PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const MAX_RETURN_NOTE = 500;

export const RETURN_REASONS: { value: ReturnReason; label: string }[] = [
  { value: "defect", label: "Lỗi sản phẩm" },
  { value: "wrong_item", label: "Giao sai mẫu / size" },
  { value: "not_as_described", label: "Không giống mô tả" },
  { value: "other", label: "Lý do khác" },
];

export const RETURN_STATUS: Record<ReturnStatus, { label: string; detail: string }> = {
  requested: { label: "Chờ duyệt", detail: "Shop đã nhận yêu cầu trả hàng và sẽ liên hệ với bạn." },
  approved: { label: "Đã duyệt", detail: "Yêu cầu đã được duyệt. Shop sẽ gửi SPX đến lấy hàng tại địa chỉ giao hàng." },
  pickup_booked: { label: "Chờ lấy hàng", detail: "SPX sẽ đến lấy hàng. Vui lòng đóng gói sản phẩm (kèm quà tặng nếu có) và giao cho shipper." },
  received: { label: "Đã nhận hàng", detail: "Shop đã nhận lại hàng. Tiền hoàn sẽ được chuyển khoản trong 3–5 ngày làm việc." },
  refunded: { label: "Đã hoàn tiền", detail: "Shop đã chuyển khoản hoàn tiền cho bạn." },
  rejected: { label: "Không được chấp nhận", detail: `Yêu cầu trả hàng không được chấp nhận. Cần hỗ trợ? Gọi ${HOTLINE}.` },
  cancelled: { label: "Đã hủy", detail: `Yêu cầu trả hàng đã được hủy. Cần hỗ trợ? Gọi ${HOTLINE}.` },
};

// Statuses that still hold their quantities (rejected / cancelled ones free them again).
const HOLDING: ReturnStatus[] = ["requested", "approved", "pickup_booked", "received", "refunded"];
const OPEN: ReturnStatus[] = ["requested", "approved", "pickup_booked"];

type Line = { id: string; qty: number; isGift: boolean };
type Request = { status: ReturnStatus; items: { orderItemId: string; qty: number }[] };

/** How many units of each line can still be asked back (0 for gift lines). */
export function returnableQty(lines: Line[], requests: Request[]): Record<string, number> {
  const held: Record<string, number> = {};
  for (const r of requests) {
    if (!HOLDING.includes(r.status)) continue;
    for (const i of r.items) held[i.orderItemId] = (held[i.orderItemId] ?? 0) + i.qty;
  }
  return Object.fromEntries(lines.map((l) => [l.id, l.isGift ? 0 : Math.max(0, l.qty - (held[l.id] ?? 0))]));
}

/** Deadline for a new request (delivered + 7 days), or null when the order was never delivered. */
export function returnDeadline(deliveredAt: string | null): Date | null {
  return deliveredAt ? new Date(new Date(deliveredAt).getTime() + RETURN_DAYS * 86_400_000) : null;
}

/** Whether the form may be offered now. */
export function canRequestReturn(
  order: { status: string; deliveredAt: string | null; lines: Line[]; requests: Request[] },
  now = new Date(),
) {
  const deadline = returnDeadline(order.deliveredAt);
  if (order.status !== "delivered" || !deadline || now > deadline) return false;
  if (order.requests.some((r) => OPEN.includes(r.status))) return false;
  return Object.values(returnableQty(order.lines, order.requests)).some((n) => n > 0);
}
