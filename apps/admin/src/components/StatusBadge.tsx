import { STATUS_LABEL, type OrderStatus } from "@/lib/order-status";
import { RETURN_STATUS_LABEL, type ReturnStatus } from "@/lib/returns";

// DASHBOARD_DESIGN.md §2/§5: the only place status colours appear. Full literal
// class names so Tailwind generates them.
const COLORS: Record<OrderStatus, string> = {
  pending: "bg-status-pending-bg text-status-pending",
  confirmed: "bg-status-confirmed-bg text-status-confirmed",
  shipped: "bg-status-shipped-bg text-status-shipped",
  delivered: "bg-status-delivered-bg text-status-delivered",
  cancelled: "bg-status-cancelled-bg text-status-cancelled",
  delivery_failed: "bg-status-delivery-failed-bg text-status-delivery-failed",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-sm px-2.5 py-1 text-badge uppercase ${COLORS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

// Returns reuse the order badge colours by meaning (DASHBOARD_DESIGN.md §2): waiting, in progress,
// on its way, done, refused, cancelled.
const RETURN_COLORS: Record<ReturnStatus, string> = {
  requested: COLORS.pending,
  approved: COLORS.confirmed,
  pickup_booked: COLORS.shipped,
  received: COLORS.delivered,
  refunded: COLORS.delivered,
  rejected: COLORS.delivery_failed,
  cancelled: COLORS.cancelled,
};

export function ReturnStatusBadge({ status }: { status: ReturnStatus }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-sm px-2.5 py-1 text-badge uppercase ${RETURN_COLORS[status]}`}>
      {RETURN_STATUS_LABEL[status]}
    </span>
  );
}
