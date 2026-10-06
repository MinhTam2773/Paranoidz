import Link from "next/link";
import { createAdminClient } from "@paranoidz/db/admin";
import { ProductEditor } from "@/components/products/ProductForm";
import { requireAdmin } from "@/lib/auth";

export default async function NewProductPage() {
  await requireAdmin();
  const { data: categories } = await createAdminClient().from("categories").select("id, name").order("sort_order");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Link href="/products" className="text-label uppercase text-text-secondary hover:text-text-primary">‹ Sản phẩm</Link>
        <h2 className="text-page-title">Sản phẩm mới</h2>
        <p className="text-text-secondary">Tạo sản phẩm trước, sau đó thêm ảnh ở trang chỉnh sửa.</p>
      </div>
      <ProductEditor
        version="new"
        categories={categories ?? []}
        initial={{ name: "", slug: "", categoryId: "", description: "", careInstructions: "", sizeGuide: "", isActive: false, variants: [] }}
      />
    </div>
  );
}
