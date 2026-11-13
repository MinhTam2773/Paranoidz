import Link from "next/link";
import { createAdminClient } from "@paranoidz/db/admin";
import { ReturnsIcon } from "@/components/icons";
import { Pagination } from "@/components/Pagination";
import { ReturnStatusBadge } from "@/components/StatusBadge";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, formatPhone } from "@/lib/format";
import { isReturnStatus, RETURN_REASON_LABEL, RETURN_STATUS_LABEL, type ReturnStatus } from "@/lib/returns";

const PAGE_SIZE = 20;

// DASHBOARD_DESIGN.md §6.2b tab order: the work queue first.
const TABS: { status: ReturnStatus | null; label: string }[] = [
  ...(["requested", "approved", "pickup_booked", "received", "refunded", "rejected", "cancelled"] as const).map((status) => ({
    status,
    label: RETURN_STATUS_LABEL[status],
  })),
  { status: null, label: "Tất cả" },
];

function href(status: ReturnStatus | null, page = 1) {
  const params = new URLSearchParams({ status: status ?? "all" });
  if (page > 1) params.set("page", String(page));
  return `/returns?${params}`;
}

export default async function ReturnsPage({ searchParams }: PageProps<"/returns">) {
  await requireAdmin();
  const sp = await searchParams;
  // No status in the URL → the queue (Chờ duyệt); "all" → every request.
  const status = sp.status === "all" ? null : isReturnStatus(sp.status) ? sp.status : "requested";
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);

  let query = createAdminClient()
    .from("return_requests")
    .select("id, status, reason, created_at, orders(order_number, recipient_name, phone), return_items(qty)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) query = query.eq("status", status);
  const { data, count, error } = await query;
  if (error) throw error;

  const rows = data.map((r) => ({ ...r, units: r.return_items.reduce((n, i) => n + i.qty, 0) }));
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
                  href={href(tab.status)}
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

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-sm border border-border bg-surface px-6 py-16 text-center text-text-secondary">
          <ReturnsIcon width={32} height={32} className="text-text-muted" />
          <p>{status ? `Không có yêu cầu trả hàng nào ở mục "${RETURN_STATUS_LABEL[status]}".` : "Chưa có yêu cầu trả hàng nào."}</p>
        </div>
      ) : (
        <>
          <table className="hidden w-full overflow-hidden rounded-sm border border-border bg-surface md:table">
            <thead className="bg-bg-secondary text-left">
              <tr className="text-th uppercase text-text-secondary">
                <th scope="col" className="px-4 py-3">Mã đơn</th>
                <th scope="col" className="px-4 py-3">Khách hàng</th>
                <th scope="col" className="px-4 py-3">Số điện thoại</th>
                <th scope="col" className="px-4 py-3 text-right">Số lượng</th>
                <th scope="col" className="px-4 py-3">Lý do</th>
                <th scope="col" className="px-4 py-3">Trạng thái</th>
                <th scope="col" className="px-4 py-3">Gửi lúc</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="relative h-14 border-t border-border hover:bg-bg-secondary">
                  <td className="px-4 font-semibold">
                    <Link href={`/returns/${r.id}`} className="after:absolute after:inset-0">{r.orders.order_number}</Link>
                  </td>
                  <td className="px-4">{r.orders.recipient_name}</td>
                  <td className="whitespace-nowrap px-4">{formatPhone(r.orders.phone)}</td>
                  <td className="px-4 text-right">{r.units}</td>
                  <td className="px-4">{RETURN_REASON_LABEL[r.reason] ?? r.reason}</td>
                  <td className="px-4"><ReturnStatusBadge status={r.status} /></td>
                  <td className="whitespace-nowrap px-4 text-text-secondary">{formatDateTime(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="flex flex-col gap-2 md:hidden">
            {rows.map((r) => (
              <li key={r.id} className="rounded-sm border border-border bg-surface">
                <Link href={`/returns/${r.id}`} className="flex flex-col gap-1 p-4">
                  <span className="flex items-start justify-between gap-2">
                    <span className="font-semibold">{r.orders.order_number}</span>
                    <ReturnStatusBadge status={r.status} />
                  </span>
                  <span className="wrap-break-word">{r.orders.recipient_name} · {formatPhone(r.orders.phone)}</span>
                  <span className="text-text-secondary">
                    {r.units} sản phẩm · {RETURN_REASON_LABEL[r.reason] ?? r.reason} · {formatDateTime(r.created_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <Pagination page={page} pages={pages} href={(p) => href(status, p)} />
    </div>
  );
}
