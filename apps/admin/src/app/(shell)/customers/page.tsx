import Link from "next/link";
import { createAdminClient } from "@paranoidz/db/admin";
import { CustomersIcon } from "@/components/icons";
import { Pagination } from "@/components/Pagination";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, formatPhone } from "@/lib/format";

const PAGE_SIZE = 20;
const blacklistBadge = "inline-block whitespace-nowrap rounded-sm bg-accent px-2.5 py-1 text-badge uppercase text-text-on-dark";

function href(q: string, page = 1) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const s = params.toString();
  return s ? `/customers?${s}` : "/customers";
}

// DASHBOARD_DESIGN.md §6.4 list, adapted: a customer is a phone (ARCHITECTURE.md
// §2.4), often a guest. Name / email come from that phone's orders.
export default async function CustomersPage({ searchParams }: PageProps<"/customers">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const admin = createAdminClient();

  let query = admin
    .from("customers")
    .select("phone, delivered_count, refusal_count, is_blacklisted, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (q) {
    let digits = q.replace(/\D/g, "");
    if (/^84\d{9}$/.test(digits)) digits = "0" + digits.slice(2);
    if (/\p{L}/u.test(q)) {
      // A name: phones whose orders or account carry it (.ilike = one filter value, no injection).
      const [byOrder, byAccount] = await Promise.all([
        admin.from("orders").select("phone").ilike("recipient_name", `%${q}%`).limit(500),
        admin.from("profiles").select("phone").ilike("full_name", `%${q}%`).not("phone", "is", null).limit(500),
      ]);
      const phones = [...new Set([...(byOrder.data ?? []), ...(byAccount.data ?? [])].map((r) => r.phone!))];
      query = query.in("phone", phones.length ? phones : ["-"]);
    } else {
      query = digits.length >= 3 ? query.like("phone", `%${digits}%`) : query.in("phone", ["-"]);
    }
  }
  const { data: customers, count, error } = await query;
  if (error) throw error;

  const phones = customers.map((c) => c.phone);
  const [{ data: orders }, { data: accounts }] = await Promise.all([
    admin.from("orders").select("phone, recipient_name, email, created_at").in("phone", phones).order("created_at", { ascending: false }),
    admin.from("profiles").select("phone, full_name").in("phone", phones),
  ]);
  // Newest first, so the first match per phone is its latest order.
  const latest = (phone: string) => orders?.find((o) => o.phone === phone);
  const rows = customers.map((c) => {
    const account = accounts?.find((a) => a.phone === c.phone);
    return {
      ...c,
      name: latest(c.phone)?.recipient_name ?? account?.full_name ?? "—",
      email: orders?.find((o) => o.phone === c.phone && o.email)?.email ?? null,
      hasAccount: !!account,
    };
  });
  const pages = Math.ceil((count ?? 0) / PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <form action="/customers" role="search" className="flex gap-2">
        <input
          type="search" name="q" defaultValue={q} maxLength={100}
          aria-label="Tìm theo tên hoặc số điện thoại" placeholder="Tên hoặc số điện thoại"
          className="h-10 w-full max-w-sm rounded-sm border border-border bg-surface px-3 text-base placeholder:text-text-muted focus:border-text-primary focus:shadow-[0_0_0_2px_var(--color-accent-soft)] focus:outline-none md:text-input"
        />
        <button type="submit" className="h-10 shrink-0 rounded-sm border border-text-primary px-4 text-button uppercase transition-colors duration-200 hover:bg-text-primary hover:text-text-on-dark">
          Tìm
        </button>
      </form>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-sm border border-border bg-surface px-6 py-16 text-center text-text-secondary">
          <CustomersIcon width={32} height={32} className="text-text-muted" />
          <p>{q ? "Không có khách hàng nào khớp." : "Chưa có khách hàng nào. Khách hàng xuất hiện khi đặt đơn đầu tiên."}</p>
          {q && <Link href="/customers" className="flex h-10 items-center rounded-sm bg-accent px-4 text-button uppercase text-text-on-dark hover:bg-accent-hover">Xóa bộ lọc</Link>}
        </div>
      ) : (
        <>
          <table className="hidden w-full overflow-hidden rounded-sm border border-border bg-surface md:table">
            <thead className="bg-bg-secondary text-left">
              <tr className="text-th uppercase text-text-secondary">
                <th scope="col" className="px-4 py-3">Tên</th>
                <th scope="col" className="px-4 py-3">Số điện thoại</th>
                <th scope="col" className="px-4 py-3">Email</th>
                <th scope="col" className="px-4 py-3 text-right">Đã giao</th>
                <th scope="col" className="px-4 py-3 text-right">Từ chối</th>
                <th scope="col" className="px-4 py-3">Khách từ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.phone} className="relative h-14 border-t border-border hover:bg-bg-secondary">
                  <td className="px-4">
                    <span className="flex flex-wrap items-center gap-2">
                      <Link href={`/customers/${c.phone}`} className="font-semibold after:absolute after:inset-0">{c.name}</Link>
                      {c.is_blacklisted && <span className={blacklistBadge}>Danh sách đen</span>}
                      {c.hasAccount && <span className="text-stat-label text-text-secondary">Có tài khoản</span>}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4">{formatPhone(c.phone)}</td>
                  <td className="max-w-56 truncate px-4 text-text-secondary">{c.email ?? "—"}</td>
                  <td className="px-4 text-right">{c.delivered_count}</td>
                  <td className={`px-4 text-right ${c.refusal_count ? "font-semibold text-accent" : ""}`}>{c.refusal_count}</td>
                  <td className="whitespace-nowrap px-4 text-text-secondary">{formatDateTime(c.created_at).slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="flex flex-col gap-2 md:hidden">
            {rows.map((c) => (
              <li key={c.phone}>
                <Link href={`/customers/${c.phone}`} className="flex flex-col gap-1 rounded-sm border border-border bg-surface p-4">
                  <span className="flex items-start justify-between gap-2">
                    <span className="font-semibold wrap-break-word">{c.name}</span>
                    {c.is_blacklisted && <span className={blacklistBadge}>Danh sách đen</span>}
                  </span>
                  <span>{formatPhone(c.phone)}{c.hasAccount && <span className="text-text-secondary"> · Có tài khoản</span>}</span>
                  <span className="text-text-secondary">
                    Đã giao {c.delivered_count} · <span className={c.refusal_count ? "font-semibold text-accent" : ""}>Từ chối {c.refusal_count}</span> · Từ {formatDateTime(c.created_at).slice(0, 10)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <Pagination page={page} pages={pages} href={(p) => href(q, p)} />
    </div>
  );
}
