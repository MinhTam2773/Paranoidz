import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@paranoidz/db/admin";
import { mediaUrl } from "@paranoidz/db/media";
import { ReturnActions } from "@/components/returns/ReturnActions";
import { ReturnStatusBadge } from "@/components/StatusBadge";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, formatPhone, formatVnd } from "@/lib/format";
import { RETURN_REASON_LABEL, suggestedRefund } from "@/lib/returns";

const card = "rounded-sm border border-border bg-surface p-5";
const cardTitle = "mb-4 text-card-title uppercase";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Return detail (DASHBOARD_DESIGN.md §6.2b). return_* tables have no admin RLS policy: read with the
// service role after requireAdmin(); every change goes through transition_return().
export default async function ReturnDetailPage({ params }: PageProps<"/returns/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const { data: r, error } = await createAdminClient()
    .from("return_requests")
    .select(
      "id, status, reason, note, admin_note, spx_tracking_no, refund_amount, refund_note, created_at, received_at, refunded_at, orders(order_number, recipient_name, phone, address, ward, city, payment_method, discount, gacha_discount, order_items(price_snapshot, qty, is_gift)), return_items(qty, order_items(name_snapshot, color_snapshot, size_snapshot, price_snapshot, image_snapshot)), return_images(id, storage_path, sort_order), return_status_history(id, status, note, created_at)",
    )
    .eq("id", id)
    .order("sort_order", { referencedTable: "return_images" })
    .order("created_at", { referencedTable: "return_status_history" })
    .maybeSingle();
  if (error) throw error;
  if (!r) notFound();

  const order = r.orders;
  const refund = suggestedRefund(
    {
      lines: order.order_items.map((i) => ({ price: i.price_snapshot, qty: i.qty, isGift: i.is_gift })),
      discount: order.discount,
      gachaDiscount: order.gacha_discount,
    },
    r.return_items.map((i) => ({ price: i.order_items.price_snapshot, qty: i.qty })),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/returns" className="text-label uppercase text-text-secondary hover:text-text-primary">‹ Trả hàng</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-page-title">Trả hàng · {order.order_number}</h2>
          <ReturnStatusBadge status={r.status} />
        </div>
        <p className="text-text-secondary">Gửi lúc {formatDateTime(r.created_at)}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className={card}>
            <div className="mb-4 flex items-center justify-between gap-4">
              <h3 className="text-card-title uppercase">Khách hàng</h3>
              <Link href={`/orders/${order.order_number}`} className="text-label uppercase text-text-secondary hover:text-text-primary">Xem đơn ›</Link>
            </div>
            <dl className="grid gap-y-1 sm:grid-cols-[140px_1fr] sm:gap-x-6 sm:gap-y-3">
              <Row label="Tên">{order.recipient_name}</Row>
              <Row label="Số điện thoại">{formatPhone(order.phone)}</Row>
              <Row label="Lấy hàng tại">{[order.address, order.ward, order.city].filter(Boolean).join(", ")}</Row>
              <Row label="Thanh toán">{order.payment_method === "bank_transfer" ? "Chuyển khoản" : "COD"}</Row>
              <Row label="Lý do">{RETURN_REASON_LABEL[r.reason] ?? r.reason}</Row>
              <Row label="Mô tả">{r.note || "—"}</Row>
              <Row label="Khách xác nhận">Chưa giặt, còn nguyên tem mác</Row>
            </dl>
          </section>

          <section className={card}>
            <h3 className={cardTitle}>Sản phẩm trả</h3>
            <ul className="flex flex-col divide-y divide-border">
              {r.return_items.map((item, i) => (
                <li key={i} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="relative aspect-3/4 w-14 shrink-0 overflow-hidden rounded-sm bg-bg-tertiary">
                    {item.order_items.image_snapshot && (
                      <Image src={mediaUrl("product-images", item.order_items.image_snapshot)} alt="" fill sizes="56px" className="object-cover" />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="font-medium wrap-break-word">{item.order_items.name_snapshot}</span>
                    <span className="text-stat-label uppercase text-text-secondary">
                      {[item.order_items.color_snapshot, item.order_items.size_snapshot].filter(Boolean).join(" / ")}
                    </span>
                    <span className="text-text-secondary">{item.qty} × {formatVnd(item.order_items.price_snapshot)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className={card}>
            <h3 className={cardTitle}>Ảnh khách gửi ({r.return_images.length})</h3>
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {r.return_images.map((img, i) => (
                <li key={img.id}>
                  <a href={mediaUrl("return-images", img.storage_path)} target="_blank" rel="noopener noreferrer" className="relative block aspect-square overflow-hidden rounded-sm border border-border bg-bg-tertiary">
                    <Image src={mediaUrl("return-images", img.storage_path)} alt={`Ảnh ${i + 1}`} fill sizes="160px" className="object-cover" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className={card}>
            <h3 className={cardTitle}>Hoàn tiền</h3>
            <dl className="flex flex-col gap-3">
              <div className="flex justify-between gap-4"><dt className="text-text-secondary">Gợi ý</dt><dd>{formatVnd(refund)}</dd></div>
              {r.refund_amount !== null && (
                <div className="flex justify-between gap-4 font-semibold"><dt>Đã hoàn</dt><dd>{formatVnd(r.refund_amount)}</dd></div>
              )}
              {r.refund_note && <p className="text-text-secondary">{r.refund_note}</p>}
              {r.spx_tracking_no && (
                <div className="flex justify-between gap-4"><dt className="text-text-secondary">Mã vận đơn lấy hàng</dt><dd className="font-semibold">{r.spx_tracking_no}</dd></div>
              )}
            </dl>
            <p className="mt-4 text-text-secondary">Giá khách đã trả cho các sản phẩm trả, trừ phần giảm giá của đơn; không gồm phí vận chuyển.</p>
          </section>

          <section className={card}>
            <h3 className={cardTitle}>Trạng thái</h3>
            <ol className="mb-5 flex flex-col gap-4 border-l border-border pl-4">
              {r.return_status_history.map((h) => (
                <li key={h.id} className="flex flex-col items-start gap-1">
                  <ReturnStatusBadge status={h.status} />
                  <span className="text-stat-label text-text-secondary">{formatDateTime(h.created_at)}</span>
                  {h.note && <span className="text-text-secondary">{h.note}</span>}
                </li>
              ))}
            </ol>
            <ReturnActions returnId={r.id} status={r.status} suggestedRefund={refund} />
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
