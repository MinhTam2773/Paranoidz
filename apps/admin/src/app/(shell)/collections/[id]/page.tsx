import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@paranoidz/db/admin";
import { CollectionForm } from "@/components/collections/CollectionForm";
import { requireAdmin } from "@/lib/auth";
import { pickerProducts } from "../_products";

export default async function EditCollectionPage({ params }: PageProps<"/collections/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [{ data: collection, error }, products] = await Promise.all([
    createAdminClient()
      .from("collections")
      .select("id, name, slug, is_active, collection_items(product_id, sort_order)")
      .eq("id", id)
      .maybeSingle(),
    pickerProducts(),
  ]);
  if (error) throw error;
  if (!collection) notFound();
  const productIds = [...collection.collection_items].sort((a, b) => a.sort_order - b.sort_order).map((i) => i.product_id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Link href="/collections" className="text-label uppercase text-text-secondary hover:text-text-primary">‹ Bộ sưu tập</Link>
        <h2 className="text-page-title wrap-break-word">{collection.name}</h2>
      </div>
      <CollectionForm
        initial={{ id: collection.id, name: collection.name, slug: collection.slug, isActive: collection.is_active, productIds }}
        products={products}
      />
    </div>
  );
}
