import Link from "next/link";
import { createAdminClient } from "@paranoidz/db/admin";
import { ActiveToggle } from "@/components/ActiveToggle";
import { BundlesIcon } from "@/components/icons";
import { Pagination } from "@/components/Pagination";
import { requireAdmin } from "@/lib/auth";
import { formatVnd } from "@/lib/format";
import { setBundleActive } from "./actions";

const PAGE_SIZE = 20;

// DASHBOARD_DESIGN.md §6.5 list.
export default async function BundlesPage({ searchParams }: PageProps<"/bundles">) {
  await requireAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const { data, count, error } = await createAdminClient()
    .from("bundles")
    .select("id, name, discount_amount, is_active, bundle_items(count)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (error) throw error;

  const bundles = data.map((b) => ({ ...b, items: b.bundle_items[0]?.count ?? 0 }));
  const pages = Math.ceil((count ?? 0) / PAGE_SIZE);
  const newButton = (
    <Link href="/bundles/new" className="flex h-10 shrink-0 items-center justify-center rounded-sm bg-accent px-4 text-button uppercase text-text-on-dark hover:bg-accent-hover">
      Thêm combo
    </Link>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-text-secondary">Đơn có đủ sản phẩm của combo được giảm cho mỗi bộ. Không cộng dồn với mã giảm giá.</p>
        {newButton}
      </div>

      {bundles.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-sm border border-border bg-surface px-6 py-16 text-center text-text-secondary">
          <BundlesIcon width={32} height={32} className="text-text-muted" />
          <p>Chưa có combo nào.</p>
          {newButton}
        </div>
      ) : (
        <>
          {/* ≥768px: table; the name link is stretched over the row. */}
          <table className="hidden w-full overflow-hidden rounded-sm border border-border bg-surface md:table">
            <thead className="bg-bg-secondary text-left">
              <tr className="text-th uppercase text-text-secondary">
                <th scope="col" className="px-4 py-3">Tên</th>
                <th scope="col" className="px-4 py-3 text-right">Sản phẩm</th>
                <th scope="col" className="px-4 py-3 text-right">Giảm mỗi combo</th>
                <th scope="col" className="px-4 py-3">Đang áp dụng</th>
              </tr>
            </thead>
            <tbody>
              {bundles.map((b) => (
                <tr key={b.id} className="relative h-14 border-t border-border hover:bg-bg-secondary">
                  <td className="px-4 font-semibold">
                    <Link href={`/bundles/${b.id}`} className="after:absolute after:inset-0">{b.name}</Link>
                  </td>
                  <td className="px-4 text-right">{b.items}</td>
                  <td className="whitespace-nowrap px-4 text-right">{formatVnd(b.discount_amount)}</td>
                  <td className="px-4"><ActiveToggle offLabel="đã tắt" name={b.name} active={b.is_active} label="Đang áp dụng" setActive={setBundleActive.bind(null, b.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* <768px: stacked cards (§4 mobile). */}
          <ul className="flex flex-col gap-2 md:hidden">
            {bundles.map((b) => (
              <li key={b.id} className="relative flex gap-3 rounded-sm border border-border bg-surface p-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Link href={`/bundles/${b.id}`} className="font-semibold wrap-break-word after:absolute after:inset-0">{b.name}</Link>
                  <span className="text-text-secondary">{b.items} sản phẩm · giảm {formatVnd(b.discount_amount)} mỗi combo</span>
                </div>
                <ActiveToggle offLabel="đã tắt" name={b.name} active={b.is_active} label="Đang áp dụng" setActive={setBundleActive.bind(null, b.id)} />
              </li>
            ))}
          </ul>
        </>
      )}

      <Pagination page={page} pages={pages} href={(p) => (p > 1 ? `/bundles?page=${p}` : "/bundles")} />
    </div>
  );
}
