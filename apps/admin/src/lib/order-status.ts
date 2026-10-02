import type { Database } from "@paranoidz/db/types";

export type OrderStatus = Database["public"]["Enums"]["order_status"];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  shipped: "Đang giao",
  delivered: "Đã giao",
  cancelled: "Đã hủy",
  delivery_failed: "Giao thất bại",
};

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && value in STATUS_LABEL;
}

export type OrderAction = { to: OrderStatus; label: string; body: string; destructive?: boolean };

const CANCEL: OrderAction = {
  to: "cancelled",
  label: "Hủy đơn",
  body: "Hàng được trả lại kho và mã giảm giá (nếu có) được hoàn lại. Không thể hoàn tác.",
  destructive: true,
};

// Mirrors the valid transitions in transition_order_status(), which re-checks them.
export const ORDER_ACTIONS: Record<OrderStatus, { primary?: OrderAction; secondary: OrderAction[] }> = {
  pending: {
    primary: { to: "confirmed", label: "Xác nhận đơn", body: "Đã gọi xác nhận với khách. Đơn chuyển sang Đã xác nhận." },
    secondary: [CANCEL],
  },
  confirmed: {
    primary: { to: "shipped", label: "Đánh dấu đang giao", body: "Đơn đã được giao cho đơn vị vận chuyển." },
    secondary: [CANCEL],
  },
  shipped: {
    primary: { to: "delivered", label: "Đánh dấu đã giao", body: "Khách đã nhận hàng và thanh toán. Không thể hoàn tác." },
    secondary: [
      {
        to: "delivery_failed",
        label: "Giao thất bại",
        body: "Khách không nhận hàng. Hàng được trả lại kho và số lần từ chối của số điện thoại này tăng thêm 1. Không thể hoàn tác.",
        destructive: true,
      },
    ],
  },
  delivered: { secondary: [] },
  cancelled: { secondary: [] },
  delivery_failed: { secondary: [] },
};
