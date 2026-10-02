import Link from "next/link";
import { createAdminClient } from "@paranoidz/db/admin";
import { OrdersIcon } from "@/components/icons";
import { StatusBadge } from "@/components/StatusBadge";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, formatPhone, formatVnd } from "@/lib/format";
import { isOrderStatus, STATUS_LABEL, type OrderStatus } from "@/lib/order-status";

const PAGE_SIZE = 20;

// DASHBOARD_DESIGN.md §6.2 tab order.
const TABS: { status: OrderStatus | null; label: string }[] = [
  { status: null, label: "Tất cả" },
  ...(["pending", "confirmed", "shipped", "delivered", "cancelled", "delivery_failed"] as const).map((status) => ({
    status,
    label: STATUS_LABEL[status],
  })),
];

// Order number or phone. Only [A-Z0-9-] / digits reach the PostgREST filter, so
// the input can't inject filter syntax. "+84 90…" matches the stored "090…".
function searchFilter(q: string) {
  const term = q.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  let digits = q.replace(/\D/g, "");
  if (/^84\d{9}$/.test(digits)) digits = "0" + digits.slice(2);
  const parts: string[] = [];
  if (term) parts.push(`order_number.ilike.*${term}*`);
  if (digits.length >= 3) parts.push(`phone.like.*${digits}*`);
  // Nothing searchable left → match nothing rather than everything.
  return parts.join(",") || "id.is.null";
}

function href(status: OrderStatus | null, q: string, page = 1) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const s = params.toString();
  return s ? `/orders?${s}` : "/orders";
}

export default async function OrdersPage({ searchParams }: PageProps<"/orders">) {
  await requireAdmin();
  const sp = await searchParams;
  const status = isOrderStatus(sp.status) ? sp.status : null;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 50) : "";
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);

  let query = createAdminClient()
    .from("orders")
    .select("id, order_number, recipient_name, phone, total, status, created_at, order_items(qty)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) query = query.eq("status", status);
  if (q) query = query.or(searchFilter(q));
  const { data, count, error } = await query;
  if (error) throw error;

  const orders = data.map((o) => ({ ...o, items: o.order_items.reduce((n, i) => n + i.qty, 0) }));
  const pages = Math.ceil((count ?? 0) / PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Lọc theo trạng thái" className="-mx-6 overflow-x-auto px-6 [scrollbar-width:none]">
        <ul className="flex min-w-max gap-1 border-b border-border">
          {TABS.map((tab) => {
            const active = tab.status === status;
            return (
              <li key={tab.label}>
                <Link
                  href={href(tab.status, q)}
                  aria-current={active ? "page" : undefined}
                  className={`-mb-px flex h-11 items-center border-b-2 px-3 text-label uppercase ${
                    active ? "border-text-primary text-text-primary" : "border-transparent text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form action="/orders" role="search" className="flex gap-2">
        {status && <input type="hidden" name="status" value={status} />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          maxLength={50}
          aria-label="Tìm theo mã đơn hoặc số điện thoại"
          placeholder="Mã đơn hoặc số điện thoại"
          className="h-10 w-full max-w-sm rounded-sm border border-border bg-surface px-3 text-base placeholder:text-text-muted focus:border-text-primary focus:shadow-[0_0_0_2px_var(--color-accent-soft)] focus:outline-none md:text-input"
        />
        <button
          type="submit"
          className="h-10 shrink-0 rounded-sm border border-text-primary px-4 text-button uppercase transition-colors duration-200 hover:bg-text-primary hover:text-text-on-dark"
        >
          Tìm
        </button>
      </form>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-sm border border-border bg-surface px-6 py-16 text-center text-text-secondary">
          <OrdersIcon width={32} height={32} className="text-text-muted" />
          <p>{q || status ? "Không có đơn hàng nào khớp với bộ lọc." : "Chưa có đơn hàng nào."}</p>
          {(q || status) && (
            <Link href="/orders" className="flex h-10 items-center rounded-sm bg-accent px-4 text-button uppercase text-text-on-dark hover:bg-accent-hover">
              Xóa bộ lọc
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* ≥768px: table; row click opens the order (link stretched over the row). */}
          <table className="hidden w-full overflow-hidden rounded-sm border border-border bg-surface md:table">
            <thead className="bg-bg-secondary text-left">
              <tr className="text-th uppercase text-text-secondary">
                <th scope="col" className="px-4 py-3">Mã đơn</th>
                <th scope="col" className="px-4 py-3">Khách hàng</th>
                <th scope="col" className="px-4 py-3">Số điện thoại</th>
                <th scope="col" className="px-4 py-3 text-right">Số lượng</th>
                <th scope="col" className="px-4 py-3 text-right">Tổng tiền</th>
                <th scope="col" className="px-4 py-3">Trạng thái</th>
                <th scope="col" className="px-4 py-3">Ngày tạo</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="relative h-14 border-t border-border hover:bg-bg-secondary">
                  <td className="px-4 font-semibold">
                    <Link href={`/orders/${o.order_number}`} className="after:absolute after:inset-0">
                      {o.order_number}
                    </Link>
                  </td>
                  <td className="px-4">{o.recipient_name}</td>
                  <td className="whitespace-nowrap px-4">{formatPhone(o.phone)}</td>
                  <td className="px-4 text-right">{o.items}</td>
                  <td className="whitespace-nowrap px-4 text-right">{formatVnd(o.total)}</td>
                  <td className="px-4"><StatusBadge status={o.status} /></td>
                  <td className="whitespace-nowrap px-4 text-text-secondary">{formatDateTime(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* <768px: stacked cards (§4 mobile). */}
          <ul className="flex flex-col gap-2 md:hidden">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/orders/${o.order_number}`} className="flex flex-col gap-1 rounded-sm border border-border bg-surface p-4">
                  <span className="flex items-start justify-between gap-2">
                    <span className="font-semibold">{o.order_number}</span>
                    <StatusBadge status={o.status} />
                  </span>
                  <span className="wrap-break-word">{o.recipient_name} · {formatPhone(o.phone)}</span>
                  <span className="text-text-secondary">
                    {formatVnd(o.total)} · {o.items} sản phẩm · {formatDateTime(o.created_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {pages > 1 && (
        <nav aria-label="Phân trang" className="flex justify-end gap-1">
          {page > 1 && <PageLink href={href(status, q, page - 1)} label="Trang trước">‹</PageLink>}
          {Array.from({ length: pages }, (_, i) => i + 1)
            .filter((p) => Math.abs(p - page) <= 2 || p === 1 || p === pages)
            .map((p) => (
              <PageLink key={p} href={href(status, q, p)} current={p === page}>{p}</PageLink>
            ))}
          {page < pages && <PageLink href={href(status, q, page + 1)} label="Trang sau">›</PageLink>}
        </nav>
      )}
    </div>
  );
}

function PageLink({ href, current, label, children }: { href: string; current?: boolean; label?: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={current ? "page" : undefined}
      className={`flex size-10 items-center justify-center rounded-sm border ${
        current ? "border-text-primary bg-text-primary text-text-on-dark" : "border-border bg-surface hover:border-border-hover"
      }`}
    >
      {children}
    </Link>
  );
}
