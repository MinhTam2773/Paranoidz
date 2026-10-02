import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@paranoidz/db/admin";
import { OrderActions } from "@/components/orders/OrderActions";
import { StatusBadge } from "@/components/StatusBadge";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, formatPhone, formatVnd } from "@/lib/format";

const card = "rounded-sm border border-border bg-surface p-5";
const cardTitle = "mb-4 text-card-title uppercase";

export default async function OrderDetailPage({ params }: PageProps<"/orders/[number]">) {
  await requireAdmin();
  const { number } = await params;
  const admin = createAdminClient();

  const { data: order, error } = await admin
    .from("orders")
    // One literal: supabase-js infers the row type from it.
    .select(
      "id, order_number, status, created_at, recipient_name, phone, secondary_phone, email, address, ward, district, city, note, subtotal, discount, total, order_items(id, name_snapshot, color_snapshot, size_snapshot, price_snapshot, image_snapshot, qty), order_status_history(id, status, note, created_at), voucher_uses(vouchers(code))",
    )
    .eq("order_number", number)
    .order("created_at", { referencedTable: "order_status_history" })
    .maybeSingle();
  if (error) throw error;
  if (!order) notFound();

  // Refusals + blacklist are per phone (customers), not per order.
  const { data: customer } = await admin
    .from("customers")
    .select("delivered_count, refusal_count, is_blacklisted")
    .eq("phone", order.phone)
    .maybeSingle();

  const images = admin.storage.from("product-images");
  const voucherCode = order.voucher_uses?.vouchers?.code;
  const fullAddress = [order.address, order.ward, order.district, order.city].filter(Boolean).join(", ");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/orders" className="text-label uppercase text-text-secondary hover:text-text-primary">‹ Đơn hàng</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-page-title">{order.order_number}</h2>
          <StatusBadge status={order.status} />
        </div>
        <p className="text-text-secondary">Đặt lúc {formatDateTime(order.created_at)}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className={card}>
            <h3 className={cardTitle}>Khách hàng</h3>
            {customer?.is_blacklisted && (
              <p className="mb-4 inline-block rounded-sm bg-accent px-2.5 py-1 text-badge uppercase text-text-on-dark">Danh sách đen</p>
            )}
            <dl className="grid gap-y-1 sm:grid-cols-[140px_1fr] sm:gap-x-6 sm:gap-y-3">
              <Row label="Tên">{order.recipient_name}</Row>
              <Row label="Số điện thoại">
                {formatPhone(order.phone)}
                {order.secondary_phone && ` / ${formatPhone(order.secondary_phone)}`}
              </Row>
              <Row label="Email">{order.email || "—"}</Row>
              <Row label="Địa chỉ">{fullAddress}</Row>
              <Row label="Ghi chú">{order.note || "—"}</Row>
              <Row label="Lịch sử">
                Đã giao {customer?.delivered_count ?? 0} đơn · Từ chối nhận{" "}
                <span className={customer?.refusal_count ? "font-semibold text-accent" : undefined}>{customer?.refusal_count ?? 0} lần</span>
              </Row>
            </dl>
          </section>

          <section className={card}>
            <h3 className={cardTitle}>Sản phẩm</h3>
            <ul className="flex flex-col divide-y divide-border">
              {order.order_items.map((item) => (
                <li key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="relative aspect-3/4 w-14 shrink-0 overflow-hidden rounded-sm bg-bg-tertiary">
                    {item.image_snapshot && (
                      <Image src={images.getPublicUrl(item.image_snapshot).data.publicUrl} alt="" fill sizes="56px" className="object-cover" />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="font-medium wrap-break-word">{item.name_snapshot}</span>
                    <span className="text-stat-label uppercase text-text-secondary">
                      {[item.color_snapshot, item.size_snapshot].filter(Boolean).join(" / ")}
                    </span>
                    <span className="text-text-secondary">{item.qty} × {formatVnd(item.price_snapshot)}</span>
                  </div>
                  <span className="whitespace-nowrap font-semibold">{formatVnd(item.price_snapshot * item.qty)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className={card}>
            <h3 className={cardTitle}>Thanh toán (COD)</h3>
            <dl className="flex flex-col gap-3">
              <div className="flex justify-between gap-4"><dt className="text-text-secondary">Tạm tính</dt><dd>{formatVnd(order.subtotal)}</dd></div>
              {order.discount > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-text-secondary">Giảm giá{voucherCode && ` (${voucherCode})`}</dt>
                  <dd>−{formatVnd(order.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4 border-t border-border pt-3 font-semibold">
                <dt>Tổng thu</dt><dd>{formatVnd(order.total)}</dd>
              </div>
            </dl>
          </section>

          <section className={card}>
            <h3 className={cardTitle}>Trạng thái</h3>
            <ol className="mb-5 flex flex-col gap-4 border-l border-border pl-4">
              {order.order_status_history.map((h) => (
                <li key={h.id} className="flex flex-col items-start gap-1">
                  <StatusBadge status={h.status} />
                  <span className="text-stat-label text-text-secondary">{formatDateTime(h.created_at)}</span>
                  {h.note && <span className="text-text-secondary">{h.note}</span>}
                </li>
              ))}
            </ol>
            <OrderActions orderId={order.id} orderNumber={order.order_number} status={order.status} />
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="mt-3 text-label uppercase text-text-secondary first:mt-0 sm:mt-0">{label}</dt>
      <dd className="wrap-break-word">{children}</dd>
    </>
  );
}
