import Link from "next/link";
import { createAdminClient } from "@paranoidz/db/admin";
import { CollectionList } from "@/components/collections/CollectionList";
import { CollectionsIcon } from "@/components/icons";
import { requireAdmin } from "@/lib/auth";

// DASHBOARD_DESIGN.md §6.6 list. No pagination: the order is the storefront's
// display order, and reordering across pages would be awkward (collections are few).
export default async function CollectionsPage() {
  await requireAdmin();
  const { data, error } = await createAdminClient()
    .from("collections")
    .select("id, name, slug, is_active, collection_items(count)")
    .order("sort_order")
    .order("created_at");
  if (error) throw error;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-text-secondary">Thứ tự ở đây là thứ tự hiển thị trên cửa hàng. Kéo hoặc dùng ↑ ↓ để sắp xếp.</p>
        <Link href="/collections/new" className="flex h-10 shrink-0 items-center justify-center rounded-sm bg-accent px-4 text-button uppercase text-text-on-dark hover:bg-accent-hover">
          Thêm bộ sưu tập
        </Link>
      </div>
      {data.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-sm border border-border bg-surface px-6 py-16 text-center text-text-secondary">
          <CollectionsIcon width={32} height={32} className="text-text-muted" />
          <p>Chưa có bộ sưu tập nào.</p>
          <Link href="/collections/new" className="flex h-10 items-center rounded-sm bg-accent px-4 text-button uppercase text-text-on-dark hover:bg-accent-hover">Thêm bộ sưu tập</Link>
        </div>
      ) : (
        <CollectionList
          collections={data.map((c) => ({ id: c.id, name: c.name, slug: c.slug, isActive: c.is_active, count: c.collection_items[0]?.count ?? 0 }))}
        />
      )}
    </div>
  );
}
