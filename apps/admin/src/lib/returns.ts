import type { Database } from "@paranoidz/db/types";

// Customer returns in the admin (ARCHITECTURE.md §4 "Returns"; DASHBOARD_DESIGN.md §6.2b).
export type ReturnStatus = Database["public"]["Enums"]["return_status"];

export const RETURN_STATUS_LABEL: Record<ReturnStatus, string> = {
  requested: "Chờ duyệt",
  approved: "Đã duyệt",
  pickup_booked: "Chờ lấy hàng",
  received: "Đã nhận hàng",
  refunded: "Đã hoàn tiền",
  rejected: "Từ chối",
  cancelled: "Đã hủy",
};

export const RETURN_REASON_LABEL: Record<string, string> = {
  defect: "Lỗi sản phẩm",
  wrong_item: "Giao sai mẫu / size",
  not_as_described: "Không giống mô tả",
  other: "Lý do khác",
};

export function isReturnStatus(value: unknown): value is ReturnStatus {
  return typeof value === "string" && value in RETURN_STATUS_LABEL;
}

// What each status offers; transition_return() re-checks every move.
export type ReturnStep = "approve" | "reject" | "cancel" | "pickup" | "receive" | "refund";
export const RETURN_STEPS: Record<ReturnStatus, ReturnStep[]> = {
  requested: ["approve", "reject", "cancel"],
  approved: ["pickup", "receive", "reject", "cancel"],
  pickup_booked: ["receive", "reject", "cancel"],
  received: ["refund"],
  refunded: [],
  rejected: [],
  cancelled: [],
};

type Line = { price: number; qty: number; isGift: boolean };

/**
 * Suggested refund: the returned units at the price paid, minus their share of the order's code
 * discounts (discount + gacha_discount) split pro rata over the paid lines. Shipping isn't refunded.
 * The admin can change it before recording the refund.
 */
export function suggestedRefund(order: { lines: Line[]; discount: number; gachaDiscount: number }, returned: { price: number; qty: number }[]) {
  const paid = order.lines.filter((l) => !l.isGift).reduce((s, l) => s + l.price * l.qty, 0);
  const value = returned.reduce((s, r) => s + r.price * r.qty, 0);
  if (paid <= 0 || value <= 0) return 0;
  const share = ((order.discount + order.gachaDiscount) * value) / paid;
  return Math.max(0, Math.round(value - share));
}
