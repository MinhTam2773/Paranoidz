import Image from "next/image";
import Link from "next/link";
import { createAdminClient } from "@paranoidz/db/admin";
import { ProductsIcon } from "@/components/icons";
import { Pagination } from "@/components/Pagination";
import { ActiveToggle } from "@/components/ActiveToggle";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, formatVnd } from "@/lib/format";
import { setProductActive } from "./actions";

const PAGE_SIZE = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function href(q: string, category: string, page = 1) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  if (page > 1) params.set("page", String(page));
  const s = params.toString();
  return s ? `/products?${s}` : "/products";
}

// DASHBOARD_DESIGN.md §6.3 list.
export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const category = typeof sp.category === "string" && UUID.test(sp.category) ? sp.category : "";
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const admin = createAdminClient();

  let query = admin
    .from("products")
    .select("id, name, is_active, updated_at, categories(name), product_variants(price, stock), product_images(storage_path, is_primary, sort_order)", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  // .ilike is a single filter value (not an or() string), so input can't inject filter syntax.
  if (q) query = query.ilike("name", `%${q}%`);
  if (category) query = query.eq("category_id", category);
  const [{ data, count, error }, { data: categories }] = await Promise.all([
    query,
    admin.from("categories").select("id, name").order("sort_order"),
  ]);
  if (error) throw error;

  const images = admin.storage.from("product-images");
  const products = data.map((p) => {
    const prices = p.product_variants.map((v) => v.price);
    const [min, max] = [Math.min(...prices), Math.max(...prices)];
    const thumb = [...p.product_images].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)[0];
    return {
      ...p,
      priceRange: !prices.length ? "—" : min === max ? formatVnd(min) : `${formatVnd(min)} – ${formatVnd(max)}`,
      stock: p.product_variants.reduce((n, v) => n + v.stock, 0),
      thumbUrl: thumb ? images.getPublicUrl(thumb.storage_path).data.publicUrl : null,
    };
  });
  const pages = Math.ceil((count ?? 0) / PAGE_SIZE);
  const filtered = !!(q || category);

  const thumbnail = (url: string | null, width: "w-10" | "w-14") => (
    <span className={`relative block aspect-3/4 shrink-0 overflow-hidden rounded-sm bg-bg-tertiary ${width}`}>
      {url && <Image src={url} alt="" fill sizes="56px" className="object-cover" />}
    </span>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <form action="/products" role="search" className="flex flex-wrap gap-2">
          <input
            type="search" name="q" defaultValue={q} maxLength={100}
            aria-label="Tìm theo tên sản phẩm" placeholder="Tên sản phẩm"
            className="h-10 w-full rounded-sm border border-border bg-surface px-3 text-base placeholder:text-text-muted focus:border-text-primary focus:shadow-[0_0_0_2px_var(--color-accent-soft)] focus:outline-none md:w-64 md:text-input"
          />
          <select
            name="category" defaultValue={category} aria-label="Lọc theo danh mục"
            className="h-10 min-w-0 flex-1 rounded-sm border border-border bg-surface px-3 text-base focus:border-text-primary focus:outline-none md:flex-none md:text-input"
          >
            <option value="">Tất cả danh mục</option>
            {(categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button type="submit" className="h-10 rounded-sm border border-text-primary px-4 text-button uppercase transition-colors duration-200 hover:bg-text-primary hover:text-text-on-dark">
            Lọc
          </button>
        </form>
        <div className="flex gap-2">
          <Link href="/products/categories" className="flex h-10 flex-1 items-center justify-center rounded-sm border border-text-primary px-4 text-button uppercase transition-colors duration-200 hover:bg-text-primary hover:text-text-on-dark md:flex-none">
            Danh mục
          </Link>
          <Link href="/products/new" className="flex h-10 flex-1 items-center justify-center rounded-sm bg-accent px-4 text-button uppercase text-text-on-dark hover:bg-accent-hover md:flex-none">
            Thêm sản phẩm
          </Link>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-sm border border-border bg-surface px-6 py-16 text-center text-text-secondary">
          <ProductsIcon width={32} height={32} className="text-text-muted" />
          <p>{filtered ? "Không có sản phẩm nào khớp với bộ lọc." : "Chưa có sản phẩm nào."}</p>
          <Link href={filtered ? "/products" : "/products/new"} className="flex h-10 items-center rounded-sm bg-accent px-4 text-button uppercase text-text-on-dark hover:bg-accent-hover">
            {filtered ? "Xóa bộ lọc" : "Thêm sản phẩm"}
          </Link>
        </div>
      ) : (
        <>
          {/* ≥768px: table; the name link is stretched over the row. */}
          <table className="hidden w-full overflow-hidden rounded-sm border border-border bg-surface md:table">
            <thead className="bg-bg-secondary text-left">
              <tr className="text-th uppercase text-text-secondary">
                <th scope="col" className="w-16 px-4 py-3"><span className="sr-only">Ảnh</span></th>
                <th scope="col" className="px-4 py-3">Tên</th>
                <th scope="col" className="px-4 py-3">Danh mục</th>
                <th scope="col" className="px-4 py-3 text-right">Giá</th>
                <th scope="col" className="px-4 py-3 text-right">Tồn kho</th>
                <th scope="col" className="px-4 py-3">Đang bán</th>
                <th scope="col" className="px-4 py-3">Cập nhật</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="relative border-t border-border hover:bg-bg-secondary">
                  <td className="px-4 py-2">{thumbnail(p.thumbUrl, "w-10")}</td>
                  <td className="px-4 font-semibold">
                    <Link href={`/products/${p.id}`} className="after:absolute after:inset-0">{p.name}</Link>
                  </td>
                  <td className="px-4 text-text-secondary">{p.categories?.name ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 text-right">{p.priceRange}</td>
                  <td className="px-4 text-right">{p.stock}</td>
                  <td className="px-4"><ActiveToggle name={p.name} active={p.is_active} label="Đang bán" setActive={setProductActive.bind(null, p.id)} /></td>
                  <td className="whitespace-nowrap px-4 text-text-secondary">{formatDateTime(p.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* <768px: stacked cards (§4 mobile). */}
          <ul className="flex flex-col gap-2 md:hidden">
            {products.map((p) => (
              <li key={p.id} className="relative flex gap-3 rounded-sm border border-border bg-surface p-3">
                {thumbnail(p.thumbUrl, "w-14")}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Link href={`/products/${p.id}`} className="font-semibold wrap-break-word after:absolute after:inset-0">{p.name}</Link>
                  <span className="text-text-secondary">{p.categories?.name ?? "—"} · {p.priceRange}</span>
                  <span className="text-text-secondary">Tồn kho {p.stock}</span>
                </div>
                <ActiveToggle name={p.name} active={p.is_active} label="Đang bán" setActive={setProductActive.bind(null, p.id)} />
              </li>
            ))}
          </ul>
        </>
      )}

      <Pagination page={page} pages={pages} href={(p) => href(q, category, p)} />
    </div>
  );
}
