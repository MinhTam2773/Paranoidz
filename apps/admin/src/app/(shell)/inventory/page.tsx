import Link from "next/link";
import { createAdminClient } from "@paranoidz/db/admin";
import { InventoryTable, type InventoryRowView } from "@/components/inventory/InventoryTable";
import { InventoryIcon } from "@/components/icons";
import { Pagination } from "@/components/Pagination";
import { requireAdmin } from "@/lib/auth";
import { LOW_STOCK, signed } from "@/lib/inventory";

const PAGE_SIZE = 50;
const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "FREE", "FREESIZE"];
const sizeRank = (s: string) => SIZE_ORDER.indexOf(s.toUpperCase()) + 1 || SIZE_ORDER.length + 1;
const STATUSES = { all: "Tất cả", low: "Sắp hết", out: "Hết hàng" } as const;
type Status = keyof typeof STATUSES;

function href(q: string, status: Status, hide0: boolean, page = 1) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status !== "all") params.set("status", status);
  if (hide0) params.set("hide0", "1");
  if (page > 1) params.set("page", String(page));
  const s = params.toString();
  return s ? `/inventory?${s}` : "/inventory";
}

// Modelled on BigSeller's Inventory List (client, 2026-10-12): one row per variant,
// +/- adjustments that are sent to BigSeller with the next export (spec: BigSeller sync).
// The catalog is small, so everything is loaded and filtered here; move filtering to
// the query if it reaches thousands of variants.
export default async function InventoryPage({ searchParams }: PageProps<"/inventory">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 500) : "";
  const status: Status = sp.status === "low" || sp.status === "out" ? sp.status : "all";
  const hide0 = sp.hide0 === "1";
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const admin = createAdminClient();

  const [{ data: variants, error }, { data: unsent, error: uErr }] = await Promise.all([
    admin.from("product_variants").select("id, color, size, stock, sku, products(id, name, is_active, product_images(storage_path, color, is_primary, sort_order))"),
    admin.rpc("bigseller_unsent"),
  ]);
  if (error) throw error;
  if (uErr) throw uErr;

  const pendingBy = new Map(unsent.map((u) => [u.variant_id, u.unsent_adj + u.unsent_back - u.unsent_out]));
  const images = admin.storage.from("product-images");
  const all: InventoryRowView[] = variants
    .flatMap((v) => (v.products ? [{ ...v, product: v.products }] : []))
    .map((v) => {
      const photo = [...v.product.product_images].sort(
        (a, b) => Number(b.color === v.color) - Number(a.color === v.color) || Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order,
      )[0];
      return {
        id: v.id, productId: v.product.id, productName: v.product.name, active: v.product.is_active,
        color: v.color, size: v.size, sku: v.sku, stock: v.stock, pending: pendingBy.get(v.id) ?? 0,
        thumbUrl: photo ? images.getPublicUrl(photo.storage_path).data.publicUrl : null,
      };
    })
    .sort((a, b) => a.productName.localeCompare(b.productName, "vi") || a.color.localeCompare(b.color, "vi") || sizeRank(a.size) - sizeRank(b.size));

  // Search: "a, b, c" = exact SKUs (paste a list, as in BigSeller); otherwise part of the name or SKU.
  const norm = (s: string) => s.normalize("NFC").toLowerCase();
  const skuList = q.includes(",") ? new Set(q.split(",").map((s) => norm(s.trim())).filter(Boolean)) : null;
  const filtered = all.filter((r) => {
    if (status === "low" && !(r.stock > 0 && r.stock <= LOW_STOCK)) return false;
    if (status === "out" && r.stock !== 0) return false;
    if (hide0 && r.stock === 0) return false;
    if (skuList) return !!r.sku && skuList.has(norm(r.sku));
    return !q || norm(r.productName).includes(norm(q)) || (!!r.sku && norm(r.sku).includes(norm(q)));
  });
  const pages = Math.ceil(filtered.length / PAGE_SIZE);
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const units = filtered.reduce((n, r) => n + r.stock, 0);
  const waiting = all.filter((r) => r.pending !== 0).length;
  const narrowed = !!(q || status !== "all" || hide0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <form action="/inventory" role="search" className="flex flex-wrap items-center gap-2">
          <input
            type="search" name="q" defaultValue={q} maxLength={500}
            aria-label="Tìm theo tên sản phẩm hoặc SKU" placeholder="Tên hoặc SKU (nhiều SKU: cách nhau bằng dấu phẩy)"
            className="h-10 w-full rounded-sm border border-border bg-surface px-3 text-base placeholder:text-text-muted focus:border-text-primary focus:shadow-[0_0_0_2px_var(--color-accent-soft)] focus:outline-none md:w-96 md:text-input"
          />
          {status !== "all" && <input type="hidden" name="status" value={status} />}
          <label className="flex h-10 items-center gap-2">
            <input type="checkbox" name="hide0" value="1" defaultChecked={hide0} className="size-5 accent-text-primary" />
            Ẩn SKU tồn kho 0
          </label>
          <button type="submit" className="h-10 rounded-sm border border-text-primary px-4 text-button uppercase transition-colors duration-200 hover:bg-text-primary hover:text-text-on-dark">
            Lọc
          </button>
        </form>
        <div className="flex flex-wrap gap-2">
          <Link href="/inventory/import" className="flex h-10 items-center justify-center whitespace-nowrap rounded-sm border border-text-primary px-4 text-button uppercase hover:bg-text-primary hover:text-text-on-dark">
            Nhập từ BigSeller
          </Link>
          <Link href="/inventory/export" className="flex h-10 items-center justify-center whitespace-nowrap rounded-sm bg-accent px-4 text-button uppercase text-text-on-dark hover:bg-accent-hover">
            Xuất sang BigSeller
          </Link>
        </div>
      </div>

      <nav aria-label="Lọc theo tồn kho" className="flex flex-wrap gap-2">
        {(Object.keys(STATUSES) as Status[]).map((s) => (
          <Link
            key={s} href={href(q, s, hide0)} aria-current={s === status ? "page" : undefined}
            className={`flex h-10 items-center rounded-sm border px-4 text-label uppercase ${s === status ? "border-text-primary bg-text-primary text-text-on-dark" : "border-border bg-surface hover:border-border-hover"}`}
          >
            {STATUSES[s]}
          </Link>
        ))}
      </nav>

      <p className="text-text-secondary">
        {filtered.length} SKU · {units} sản phẩm
        {waiting > 0 && (
          <> · <Link href="/inventory/export" className="text-text-primary underline">{waiting} SKU có thay đổi chờ gửi BigSeller</Link></>
        )}
      </p>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-sm border border-border bg-surface px-6 py-16 text-center text-text-secondary">
          <InventoryIcon width={32} height={32} className="text-text-muted" />
          <p>{narrowed ? "Không có SKU nào khớp với bộ lọc." : "Chưa có sản phẩm nào. Nhập sản phẩm và tồn kho từ BigSeller."}</p>
          <Link href={narrowed ? "/inventory" : "/inventory/import"} className="flex h-10 items-center rounded-sm bg-accent px-4 text-button uppercase text-text-on-dark hover:bg-accent-hover">
            {narrowed ? "Xóa bộ lọc" : "Nhập từ BigSeller"}
          </Link>
        </div>
      ) : (
        <InventoryTable rows={rows} />
      )}

      <Pagination page={page} pages={pages} href={(p) => href(q, status, hide0, p)} />
      <p className="text-stat-label text-text-secondary">
        Chờ gửi BigSeller = thay đổi web chưa có trong BigSeller ({signed(-2)}: đã bán trên web, {signed(5)}: nhập thêm). Gửi bằng &quot;Xuất sang BigSeller&quot;.
      </p>
    </div>
  );
}
