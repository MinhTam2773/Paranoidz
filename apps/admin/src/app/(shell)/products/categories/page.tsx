import Link from "next/link";
import { createAdminClient } from "@paranoidz/db/admin";
import { CategoryManager } from "@/components/products/CategoryManager";
import { requireAdmin } from "@/lib/auth";

// DASHBOARD_DESIGN.md §6.3 categories. Few rows, so no pagination (like collections).
export default async function CategoriesPage() {
  await requireAdmin();
  const { data, error } = await createAdminClient()
    .from("categories")
    .select("id, name, products(count)")
    .order("sort_order")
    .order("name");
  if (error) throw error;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Link href="/products" className="text-label uppercase text-text-secondary hover:text-text-primary">‹ Sản phẩm</Link>
        <h2 className="text-page-title">Danh mục</h2>
        <p className="text-text-secondary">Mỗi sản phẩm thuộc một danh mục. Trang chủ cửa hàng có một hàng sản phẩm cho mỗi danh mục, theo thứ tự ở đây. Kéo hoặc dùng ↑ ↓ để sắp xếp.</p>
      </div>
      <CategoryManager categories={data.map((c) => ({ id: c.id, name: c.name, count: c.products[0]?.count ?? 0 }))} />
    </div>
  );
}
