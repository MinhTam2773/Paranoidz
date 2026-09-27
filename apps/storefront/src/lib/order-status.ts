import type { Database } from "@paranoidz/db/types";
import { HOTLINE } from "./site";

export type OrderStatus = Database["public"]["Enums"]["order_status"];

// ARCHITECTURE.md §4 statuses, in the customer's words. Shared by guest lookup and "My orders".
export const STATUS: Record<OrderStatus, { label: string; detail: string }> = {
  pending: { label: "Awaiting confirmation", detail: "We'll call you to confirm this order before shipping." },
  confirmed: { label: "Confirmed", detail: "Your order is confirmed and being packed." },
  shipped: { label: "Shipped", detail: "Your order is on its way. Have cash ready to pay on delivery." },
  delivered: { label: "Delivered", detail: "Delivered and paid. Thank you for shopping with Paranoidz." },
  cancelled: { label: "Cancelled", detail: `This order was cancelled. Questions? Call ${HOTLINE}.` },
  delivery_failed: { label: "Not delivered", detail: `Delivery wasn't completed. Call ${HOTLINE} if you still want this order.` },
};

export const placedOn = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" });
