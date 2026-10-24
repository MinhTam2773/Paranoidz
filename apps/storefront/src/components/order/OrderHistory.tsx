import Link from "next/link";
import { ChevronDownIcon } from "@/components/layout/icons";
import { formatPhone } from "@/lib/checkout-validation";
import { formatVnd } from "@/lib/format";
import { placedOn, STATUS, type OrderStatus } from "@/lib/order-status";
import { HOTLINE } from "@/lib/site";
import { OrderSummary, type OrderSummaryItem } from "./OrderSummary";

export type AccountOrder = {
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  recipientName: string;
  phone: string;
  secondaryPhone: string | null;
  address: string;
  ward: string | null;
  city: string;
  note: string | null;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  paymentMethod: string;
  paymentConfirmed: boolean;
  items: OrderSummaryItem[];
};

// Status dot colours, tokens only (DESIGN.md §2): full class names so Tailwind generates them.
const DOT: Record<OrderStatus, string> = {
  pending: "bg-warning",
  confirmed: "bg-text-primary",
  shipped: "bg-text-primary",
  delivered: "bg-success",
  cancelled: "bg-text-muted",
  delivery_failed: "bg-text-muted",
};

// "My orders" (ARCHITECTURE.md §2.4): the account's own orders only. Rows expand like the Stitch
// profile screen; it's the customer's own order, so the full delivery address is shown.
export function OrderHistory({ orders }: { orders: AccountOrder[] }) {
  return (
    <section aria-labelledby="order-history" className="flex flex-col gap-4">
      <h2 id="order-history" className="text-h3 uppercase">Lịch sử đơn hàng</h2>
      {orders.length === 0 ? (
        <p className="text-text-secondary">
          Chưa có đơn hàng nào. Đơn bạn đặt khi đã đăng nhập sẽ hiển thị ở đây.{" "}
          <Link href="/products" className="text-text-primary underline underline-offset-4 hover:text-accent">Mua sắm ngay</Link>
        </p>
      ) : (
        <div>
          <div className="hidden gap-4 border-b border-text-primary pb-3 pr-9 text-nav uppercase lg:grid lg:grid-cols-4">
            <span>Đơn hàng</span><span>Ngày đặt</span><span>Tổng tiền</span><span>Trạng thái</span>
          </div>
          <ul>
            {orders.map((order) => (
              <li key={order.orderNumber} className="border-b border-border">
                <details className="group">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-4 py-4 [&::-webkit-details-marker]:hidden">
                    {/* Mobile: number | total, date, status pill on its own row (the longest label doesn't
                        fit beside the number at 375px). lg: the four header columns. */}
                    <div className="grid flex-1 grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 lg:grid-cols-4">
                      <span className="text-product-name font-bold">{order.orderNumber}</span>
                      <span className="text-text-secondary">{placedOn.format(new Date(order.createdAt))}</span>
                      <span className="col-start-2 row-start-1 justify-self-end text-product-name font-bold lg:col-start-auto lg:row-start-auto lg:justify-self-start">
                        {formatVnd(order.total)}
                      </span>
                      <span className="col-span-2 flex items-center gap-2 justify-self-start whitespace-nowrap rounded-sm border border-border px-2 py-1 text-caption uppercase lg:col-span-1">
                        <span className={`size-2 shrink-0 rounded-sm ${DOT[order.status]}`} aria-hidden="true" />
                        {STATUS[order.status].label}
                      </span>
                    </div>
                    <ChevronDownIcon width={20} height={20} className="shrink-0 transition-transform duration-200 group-open:rotate-180" />
                  </summary>
                  <div className="flex max-w-xl flex-col gap-6 pb-6">
                    <p className="text-text-secondary">{STATUS[order.status].detail}</p>
                    {order.paymentMethod === "bank_transfer" && !order.paymentConfirmed && (
                      <p className="border-l-4 border-accent bg-accent-soft px-3 py-2 text-caption font-semibold text-text-primary">
                        Đơn chuyển khoản — chờ shop xác nhận đã nhận tiền. Shop xác nhận rồi mới giao hàng.
                      </p>
                    )}
                    {order.paymentMethod === "bank_transfer" && order.paymentConfirmed && (
                      <p className="text-text-secondary">Đã nhận tiền chuyển khoản — đơn đang được xử lý.</p>
                    )}
                    <OrderSummary items={order.items} subtotal={order.subtotal} discount={order.discount} shippingFee={order.shippingFee} total={order.total}>
                      <div className="flex flex-col gap-1 border-t border-border pt-3 text-caption text-text-secondary">
                        <span className="text-nav uppercase text-text-primary">Giao hàng</span>
                        <span>
                          {order.recipientName} · {formatPhone(order.phone)}
                          {order.secondaryPhone && ` / ${formatPhone(order.secondaryPhone)}`}
                        </span>
                        <span className="wrap-break-word">{[order.address, order.ward, order.city].filter(Boolean).join(", ")}</span>
                        {order.note && <span className="wrap-break-word">Ghi chú: {order.note}</span>}
                        <span className="text-text-muted">Cần thay đổi thông tin, vui lòng gọi {HOTLINE}.</span>
                      </div>
                    </OrderSummary>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-caption text-text-muted">
        Đặt hàng không đăng nhập? Các đơn đó không gắn với tài khoản.{" "}
        <Link href="/order-lookup" className="text-text-primary underline underline-offset-4 hover:text-accent">Tra cứu đơn hàng</Link>
      </p>
    </section>
  );
}
