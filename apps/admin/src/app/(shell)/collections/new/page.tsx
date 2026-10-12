import Link from "next/link";
import { CollectionForm } from "@/components/collections/CollectionForm";
import { requireAdmin } from "@/lib/auth";
import { pickerProducts } from "@/lib/picker-products";

export default async function NewCollectionPage() {
  await requireAdmin();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Link href="/collections" className="text-label uppercase text-text-secondary hover:text-text-primary">‹ Bộ sưu tập</Link>
        <h2 className="text-page-title">Bộ sưu tập mới</h2>
      </div>
      <CollectionForm initial={{ name: "", slug: "", description: "", isActive: true, productIds: [] }} products={await pickerProducts()} />
    </div>
  );
}
