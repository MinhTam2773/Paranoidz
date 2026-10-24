import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createAdminClient } from "@paranoidz/db/admin";
import { OrderActions } from "@/components/orders/OrderActions";
import { PaymentConfirmButton } from "@/components/orders/PaymentConfirmButton";
import { SpxCard } from "@/components/orders/SpxCard";
import { StatusBadge } from "@/components/StatusBadge";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, formatPhone, formatVnd } from "@/lib/format";

const card = "rounded-sm border border-border bg-surface p-5";
const cardTitle = "mb-4 text-card-title uppercase";
// Parcel weight per unit — same as shipping_fee() (supabase/migrations/20261009000002_shipping_fee.sql).
const UNIT_GRAMS = 300;

export default async function OrderDetailPage({ params }: PageProps<"/orders/[number]">) {
  await requireAdmin();
  const { number } = await params;
  const admin = createAdminClient();

  const { data: order, error } = await admin
    .from("orders")
    // One literal: supabase-js infers the row type from it.
    .select(
      "id, order_number, status, created_at, recipient_name, phone, secondary_phone, email, address, ward, district, city, note, subtotal, discount, shipping_fee, total, applied_bundles, delivery_method, payment_method, payment_confirmed_at, gacha_discount, gacha_code, gacha_gift, spx_tracking_no, spx_ward, spx_fee, spx_created_at, order_items(id, name_snapshot, color_snapshot, size_snapshot, price_snapshot, image_snapshot, qty), order_status_history(id, status, note, created_at), voucher_uses(vouchers(code))",
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
  // Snapshot from place_order() when a bundle discount priced the order (ARCHITECTURE.md §5).
  const bundles = (order.applied_bundles ?? []) as { name: string; sets: number }[];
  const discountSource = voucherCode ?? (bundles.length ? `Combo: ${bundles.map((b) => (b.sets > 1 ? `${b.name} ×${b.sets}` : b.name)).join(", ")}` : null);
  const fullAddress = [order.address, order.ward, order.district, order.city].filter(Boolean).join(", ");
  const units = order.order_items.reduce((sum, item) => sum + item.qty, 0);

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
            <div className="mb-4 flex items-center justify-between gap-4">
              <h3 className="text-card-title uppercase">Khách hàng</h3>
              {customer && (
                <Link href={`/customers/${order.phone}`} className="text-label uppercase text-text-secondary hover:text-text-primary">Xem khách hàng ›</Link>
              )}
            </div>
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
            <h3 className={cardTitle}>{order.payment_method === "bank_transfer" ? "Thanh toán (Chuyển khoản)" : "Thanh toán (COD)"}</h3>
            <dl className="flex flex-col gap-3">
              <div className="flex justify-between gap-4"><dt className="text-text-secondary">Tạm tính</dt><dd>{formatVnd(order.subtotal)}</dd></div>
              {order.discount > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-text-secondary">Giảm giá{discountSource && ` (${discountSource})`}</dt>
                  <dd>−{formatVnd(order.discount)}</dd>
                </div>
              )}
              {order.gacha_code && (
                <div className="flex justify-between gap-4">
                  <dt className="text-text-secondary">Quà quay thưởng ({order.gacha_code})</dt>
                  <dd>{order.gacha_discount > 0 ? `−${formatVnd(order.gacha_discount)}` : order.gacha_gift ? "Tặng kèm" : "Freeship"}</dd>
                </div>
              )}
              {order.gacha_gift && (
                <div className="flex justify-between gap-4">
                  <dt className="text-text-secondary">Quà tặng kèm</dt>
                  <dd className="text-right font-semibold">{order.gacha_gift}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4"><dt className="text-text-secondary">Phí vận chuyển</dt><dd>{formatVnd(order.shipping_fee)}</dd></div>
              <div className="flex justify-between gap-4">
                <dt className="text-text-secondary">Phương thức giao hàng</dt>
                <dd className={order.delivery_method === "express" ? "font-semibold text-accent" : ""}>
                  {order.delivery_method === "express" ? "⚡ Hoả tốc (nội thành HCM)" : "Giao thường"}
                </dd>
              </div>
              {order.payment_method === "bank_transfer" && (
                <>
                  <div className="flex justify-between gap-4"><dt className="text-text-secondary">Ngân hàng</dt><dd>Techcombank</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-text-secondary">Số tài khoản</dt><dd className="font-semibold">19076210110027</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-text-secondary">Chủ tài khoản</dt><dd>HO KINH DOANH COOLSHIRTZ</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-text-secondary">Nội dung chuyển khoản</dt><dd className="font-semibold">{order.order_number}</dd></div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-secondary">Trạng thái</dt>
                    <dd className={order.payment_confirmed_at ? "" : "font-semibold text-accent"}>
                      {order.payment_confirmed_at ? `Đã nhận tiền lúc ${formatDateTime(order.payment_confirmed_at)}` : "Chờ xác nhận thanh toán"}
                    </dd>
                  </div>
                </>
              )}
              <div className="flex justify-between gap-4 border-t border-border pt-3 font-semibold">
                <dt>{order.payment_method === "bank_transfer" ? "Tổng cần chuyển khoản" : "Tổng thu hộ (COD)"}</dt><dd>{formatVnd(order.total)}</dd>
              </div>
            </dl>
            {order.payment_method === "bank_transfer" && !order.payment_confirmed_at && (
              <div className="mt-4">
                <PaymentConfirmButton orderId={order.id} orderNumber={order.order_number} />
              </div>
            )}
            <p className="mt-4 text-text-secondary">
              Khối lượng gói hàng: {String((units * UNIT_GRAMS) / 1000).replace(".", ",")} kg ({units} sản phẩm)
            </p>
          </section>

          {order.payment_method === "bank_transfer" && !order.payment_confirmed_at ? (
            <section className={card}>
              <h3 className={cardTitle}>Vận chuyển SPX</h3>
              <p className="text-text-secondary">
                Đơn chuyển khoản chưa được xác nhận thanh toán. Xác nhận đã nhận tiền ở mục Thanh toán trước khi tạo vận đơn SPX.
              </p>
            </section>
          ) : (
            (order.spx_tracking_no || order.status === "pending" || order.status === "confirmed") && (
              <section className={card}>
                <h3 className={cardTitle}>Vận chuyển SPX</h3>
                <Suspense fallback={<p className="text-text-secondary">Đang tải dữ liệu SPX…</p>}>
                  <SpxCard order={order} />
                </Suspense>
              </section>
            )
          )}

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
            <OrderActions orderId={order.id} orderNumber={order.order_number} status={order.status} spxTrackingNo={order.spx_tracking_no} />
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
