import type { Database } from "@paranoidz/db/types";
import { HOTLINE } from "./site";

export type OrderStatus = Database["public"]["Enums"]["order_status"];

// ARCHITECTURE.md §4 statuses, in the customer's words (labels match the admin's). Shared by guest lookup and "My orders".
export const STATUS: Record<OrderStatus, { label: string; detail: string }> = {
  pending: { label: "Chờ xác nhận", detail: "Chúng tôi sẽ gọi cho bạn để xác nhận đơn trước khi giao." },
  confirmed: { label: "Đã xác nhận", detail: "Đơn hàng đã được xác nhận và đang được đóng gói." },
  shipped: { label: "Đang giao", detail: "Đơn hàng đang trên đường đến bạn. Vui lòng chuẩn bị tiền mặt để thanh toán khi nhận hàng." },
  delivered: { label: "Đã giao", detail: "Đã giao và thanh toán. Cảm ơn bạn đã mua sắm tại Paranoidz." },
  cancelled: { label: "Đã hủy", detail: `Đơn hàng này đã bị hủy. Cần hỗ trợ? Gọi ${HOTLINE}.` },
  delivery_failed: { label: "Giao thất bại", detail: `Đơn hàng chưa được giao thành công. Gọi ${HOTLINE} nếu bạn vẫn muốn nhận đơn này.` },
};

export const placedOn = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" });
