import Link from "next/link";
import { createAdminClient } from "@paranoidz/db/admin";
import { ActiveToggle } from "@/components/ActiveToggle";
import { PromoIcon } from "@/components/icons";
import { Pagination } from "@/components/Pagination";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatVnd, vnDate } from "@/lib/format";
import { setPromoActive } from "./actions";

const PAGE_SIZE = 20;

// DASHBOARD_DESIGN.md §6.7 list. promo + standing only: AUTO-FIRST5 is system-managed.
export default async function PromoCodesPage({ searchParams }: PageProps<"/promo-codes">) {
  await requireAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const { data, count, error } = await createAdminClient()
    .from("vouchers")
    .select("id, type, code, discount_pct, cap_amount, max_uses, used_count, is_active, is_listed, expires_at", { count: "exact" })
    .in("type", ["promo", "standing"])
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (error) throw error;

  const today = vnDate();
  const codes = data.map((v) => ({
    ...v,
    cap: v.cap_amount === null ? "Không giới hạn" : formatVnd(v.cap_amount),
    uses: `${v.used_count} / ${v.max_uses ?? "∞"}`,
    exhausted: v.max_uses !== null && v.used_count >= v.max_uses,
    expires: v.expires_at ? formatDate(vnDate(v.expires_at)) : "Không hết hạn",
    expired: !!v.expires_at && vnDate(v.expires_at) < today, // expiry is always the end of a Vietnam day
    kind: [v.type === "standing" ? "Dùng mọi đơn" : "Mỗi SĐT 1 lần", ...(v.is_listed ? ["Hiện ở thanh toán"] : [])].join(" · "),
  }));
  const pages = Math.ceil((count ?? 0) / PAGE_SIZE);
  const note = (text: string) => <span className="block text-stat-label text-accent">{text}</span>;
  const newButton = (
    <Link href="/promo-codes/new" className="flex h-10 shrink-0 items-center justify-center rounded-sm bg-accent px-4 text-button uppercase text-text-on-dark hover:bg-accent-hover">
      Thêm mã giảm giá
    </Link>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-text-secondary">Mã &quot;Mỗi SĐT 1 lần&quot;: mỗi số điện thoại dùng một lần; mã &quot;Dùng mọi đơn&quot; không giới hạn. Mã giảm 10% cho 5 đơn đầu được áp dụng tự động, không nằm ở đây.</p>
        {newButton}
      </div>

      {codes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-sm border border-border bg-surface px-6 py-16 text-center text-text-secondary">
          <PromoIcon width={32} height={32} className="text-text-muted" />
          <p>Chưa có mã giảm giá nào.</p>
          {newButton}
        </div>
      ) : (
        <>
          {/* ≥768px: table; the code link is stretched over the row. */}
          <table className="hidden w-full overflow-hidden rounded-sm border border-border bg-surface md:table">
            <thead className="bg-bg-secondary text-left">
              <tr className="text-th uppercase text-text-secondary">
                <th scope="col" className="px-4 py-3">Mã</th>
                <th scope="col" className="px-4 py-3 text-right">Giảm</th>
                <th scope="col" className="px-4 py-3 text-right">Giảm tối đa</th>
                <th scope="col" className="px-4 py-3 text-right">Đã dùng</th>
                <th scope="col" className="px-4 py-3">Hết hạn</th>
                <th scope="col" className="px-4 py-3">Đang bật</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((v) => (
                <tr key={v.id} className="relative h-14 border-t border-border hover:bg-bg-secondary">
                  <td className="px-4 font-semibold">
                    <Link href={`/promo-codes/${v.id}`} className="after:absolute after:inset-0">{v.code}</Link>
                    <span className="block text-stat-label font-normal text-text-secondary">{v.kind}</span>
                  </td>
                  <td className="px-4 text-right">{v.discount_pct}%</td>
                  <td className="whitespace-nowrap px-4 text-right">{v.cap}</td>
                  <td className="whitespace-nowrap px-4 text-right">{v.uses}{v.exhausted && note("Hết lượt")}</td>
                  <td className="whitespace-nowrap px-4">{v.expires}{v.expired && note("Đã hết hạn")}</td>
                  <td className="px-4"><ActiveToggle offLabel="đã tắt" name={v.code} active={v.is_active} label="Đang bật" setActive={setPromoActive.bind(null, v.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* <768px: stacked cards (§4 mobile). */}
          <ul className="flex flex-col gap-2 md:hidden">
            {codes.map((v) => (
              <li key={v.id} className="relative flex gap-3 rounded-sm border border-border bg-surface p-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Link href={`/promo-codes/${v.id}`} className="font-semibold break-all after:absolute after:inset-0">{v.code}</Link>
                  <span className="text-stat-label text-text-secondary">{v.kind}</span>
                  <span className="text-text-secondary">Giảm {v.discount_pct}% · tối đa {v.cap}</span>
                  <span className="text-text-secondary">
                    Đã dùng {v.uses}{v.exhausted && " (hết lượt)"} · {v.expires_at ? `Hết hạn ${v.expires}` : v.expires}{v.expired && " (đã qua)"}
                  </span>
                </div>
                <ActiveToggle offLabel="đã tắt" name={v.code} active={v.is_active} label="Đang bật" setActive={setPromoActive.bind(null, v.id)} />
              </li>
            ))}
          </ul>
        </>
      )}

      <Pagination page={page} pages={pages} href={(p) => (p > 1 ? `/promo-codes?page=${p}` : "/promo-codes")} />
    </div>
  );
}
