import Link from "next/link";
import { createAdminClient } from "@paranoidz/db/admin";
import { StatusBadge } from "@/components/StatusBadge";
import { requireAdmin } from "@/lib/auth";
import { formatVnd, timeAgo, vnStartOf } from "@/lib/format";

const LOW_STOCK = 3;

const card = "rounded-sm border border-border bg-surface";
const cardHeader = "flex items-center justify-between gap-4 border-b border-border px-5 py-4";
const cardTitle = "text-card-title uppercase";

// DASHBOARD_DESIGN.md §6.1.
export default async function DashboardPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const [pending, today, delivered, customers, latest, lowStock] = await Promise.all([
    admin.from("orders").select("*", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("orders").select("*", { count: "exact", head: true }).gte("created_at", vnStartOf("day")),
    // Revenue = COD actually collected: orders delivered this month (by delivery date,
    // not order date). An order reaches "delivered" once, so each counts once.
    admin.from("order_status_history").select("orders!inner(total)").eq("status", "delivered").gte("created_at", vnStartOf("month")),
    admin.from("customers").select("*", { count: "exact", head: true }),
    admin.from("orders").select("id, order_number, recipient_name, total, status, created_at").order("created_at", { ascending: false }).limit(10),
    // Hidden products aren't on sale, so their stock isn't urgent.
    admin
      .from("product_variants")
      .select("id, color, size, stock, products!inner(name, is_active)")
      .lte("stock", LOW_STOCK)
      .eq("products.is_active", true)
      .order("stock")
      .order("product_id"),
  ]);
  for (const r of [pending, today, delivered, customers, latest, lowStock]) if (r.error) throw r.error;

  const revenue = delivered.data!.reduce((sum, h) => sum + h.orders.total, 0);
  const stats = [
    { label: "Chờ xác nhận", value: String(pending.count ?? 0), href: "/orders?status=pending" },
    { label: "Đơn hôm nay", value: String(today.count ?? 0) },
    { label: "Doanh thu tháng này", value: formatVnd(revenue), hint: "Đơn đã giao trong tháng" },
    { label: "Tổng khách hàng", value: String(customers.count ?? 0), hint: "Số điện thoại đã đặt hàng" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const body = (
            <>
              <span className="text-stat-label uppercase text-text-secondary">{s.label}</span>
              <span className="text-stat">{s.value}</span>
              {s.hint && <span className="text-stat-label text-text-muted">{s.hint}</span>}
            </>
          );
          return s.href ? (
            <Link key={s.label} href={s.href} className={`${card} flex flex-col gap-2 p-5 hover:border-border-hover`}>{body}</Link>
          ) : (
            <div key={s.label} className={`${card} flex flex-col gap-2 p-5`}>{body}</div>
          );
        })}
      </div>

      <section className={card}>
        <div className={cardHeader}>
          <h2 className={cardTitle}>Đơn mới nhất</h2>
          <Link href="/orders" className="text-label uppercase text-text-secondary hover:text-text-primary">Xem tất cả ›</Link>
        </div>
        {latest.data!.length === 0 ? (
          <p className="px-5 py-10 text-center text-text-secondary">Chưa có đơn hàng nào.</p>
        ) : (
          // Row layout follows the card's width (container query), not the viewport:
          // the sidebar takes 240px, so viewport breakpoints misjudge the room.
          <ul className="@container">
            {latest.data!.map((o) => (
              <li key={o.id} className="border-t border-border first:border-t-0">
                <Link
                  href={`/orders/${o.order_number}`}
                  className="grid min-h-14 grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-bg-secondary @3xl:grid-cols-[130px_1fr_120px_150px_130px]"
                >
                  <span className="font-semibold">{o.order_number}</span>
                  <span className="justify-self-end @3xl:order-4 @3xl:justify-self-start"><StatusBadge status={o.status} /></span>
                  <span className="truncate @3xl:order-2">{o.recipient_name}</span>
                  <span className="justify-self-end whitespace-nowrap @3xl:order-3">{formatVnd(o.total)}</span>
                  <span className="col-span-2 text-stat-label text-text-secondary @3xl:order-5 @3xl:col-span-1 @3xl:justify-self-end">{timeAgo(o.created_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`${card} overflow-hidden`}>
        <div className={cardHeader}>
          <h2 className={cardTitle}>Sắp hết hàng</h2>
          <span className="text-stat-label text-text-secondary">Tồn kho ≤ {LOW_STOCK}</span>
        </div>
        {lowStock.data!.length === 0 ? (
          <p className="px-5 py-10 text-center text-text-secondary">Không có mẫu nào sắp hết hàng.</p>
        ) : (
          // -mb-px tucks the last row's bottom border under the card's.
          <ul className="-mb-px grid sm:grid-cols-2 xl:grid-cols-3">
            {lowStock.data!.map((v) => (
              <li key={v.id} className="flex min-h-14 items-center justify-between gap-4 border-b border-border px-5 py-3">
                <span className="flex min-w-0 flex-col">
                  <span className="wrap-break-word">{v.products.name}</span>
                  <span className="text-stat-label uppercase text-text-secondary">{v.color} / {v.size}</span>
                </span>
                {v.stock === 0 ? (
                  <span className="shrink-0 rounded-sm bg-accent px-2.5 py-1 text-badge uppercase text-text-on-dark">Hết hàng</span>
                ) : (
                  <span className="shrink-0 font-semibold">Còn {v.stock}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
