import Link from "next/link";
import { BundleForm } from "@/components/bundles/BundleForm";
import { requireAdmin } from "@/lib/auth";
import { pickerProducts } from "@/lib/picker-products";

export default async function NewBundlePage() {
  await requireAdmin();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Link href="/bundles" className="text-label uppercase text-text-secondary hover:text-text-primary">‹ Combo</Link>
        <h2 className="text-page-title">Combo mới</h2>
      </div>
      <BundleForm initial={{ name: "", discountAmount: "", isActive: true, productIds: [] }} products={await pickerProducts()} />
    </div>
  );
}
