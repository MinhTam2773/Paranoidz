import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@paranoidz/db/admin";
import { BundleForm } from "@/components/bundles/BundleForm";
import { requireAdmin } from "@/lib/auth";
import { pickerProducts } from "@/lib/picker-products";

export default async function EditBundlePage({ params }: PageProps<"/bundles/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [{ data: bundle, error }, products] = await Promise.all([
    createAdminClient().from("bundles").select("id, name, discount_amount, is_active, bundle_items(product_id)").eq("id", id).maybeSingle(),
    pickerProducts(),
  ]);
  if (error) throw error;
  if (!bundle) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Link href="/bundles" className="text-label uppercase text-text-secondary hover:text-text-primary">‹ Combo</Link>
        <h2 className="text-page-title wrap-break-word">{bundle.name}</h2>
      </div>
      <BundleForm
        products={products}
        initial={{
          id: bundle.id,
          name: bundle.name,
          discountAmount: String(bundle.discount_amount),
          isActive: bundle.is_active,
          productIds: bundle.bundle_items.map((i) => i.product_id),
        }}
      />
    </div>
  );
}
