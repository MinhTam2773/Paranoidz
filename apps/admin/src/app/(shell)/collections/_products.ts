import { createAdminClient } from "@paranoidz/db/admin";
import type { PickerProduct } from "@/components/collections/CollectionForm";

// Every product (hidden ones too, marked) for the collection picker. Loaded whole:
// the catalog is small, and filtering in the browser is instant.
export async function pickerProducts(): Promise<PickerProduct[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("products")
    .select("id, name, is_active, product_images(storage_path, sort_order)")
    .order("name");
  if (error) throw error;
  const storage = admin.storage.from("product-images");
  return data.map((p) => {
    const first = [...p.product_images].sort((a, b) => a.sort_order - b.sort_order)[0];
    return { id: p.id, name: p.name, isActive: p.is_active, thumbUrl: first ? storage.getPublicUrl(first.storage_path).data.publicUrl : null };
  });
}
