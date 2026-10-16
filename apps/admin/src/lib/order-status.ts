import type { Database } from "@paranoidz/db/types";

export type OrderStatus = Database["public"]["Enums"]["order_status"];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Đã tiếp nhận",
  confirmed: "Đã tạo vận đơn",
  shipped: "Đang giao",
  delivered: "Đã giao",
  cancelled: "Đã hủy",
  delivery_failed: "Giao thất bại",
};

// SPX parcel status codes (integration guide, "Order status code"), for admin messages.
export const SPX_STATUS_LABEL: Record<number, string> = {
  1001: "Chờ lấy hàng",
  2001: "Đang vận chuyển",
  2006: "Đang giao",
  3001: "Tạm giữ",
  4001: "Đã giao",
  5001: "Lấy hàng thất bại",
  5002: "Hư hỏng",
  5003: "Thất lạc",
  6001: "Đang hoàn hàng",
  6002: "Hoàn hàng thất bại",
  6003: "Đã hoàn hàng",
  7001: "Đã hủy lấy hàng",
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
// pending → confirmed has no button: creating the SPX shipment confirms the order.
export const ORDER_ACTIONS: Record<OrderStatus, { primary?: OrderAction; secondary: OrderAction[] }> = {
  pending: { secondary: [CANCEL] },
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
