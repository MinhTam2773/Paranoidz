import { createAdminClient } from "@paranoidz/db/admin";

// minPrice = cheapest variant (any stock), null if the product has no variants.
export type PickerProduct = { id: string; name: string; isActive: boolean; thumbUrl: string | null; minPrice: number | null };

// Every product (hidden ones too, marked) for the collection and bundle pickers.
// Loaded whole: the catalog is small, and filtering in the browser is instant.
export async function pickerProducts(): Promise<PickerProduct[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("products")
    .select("id, name, is_active, product_images(storage_path, sort_order), product_variants(price)")
    .order("name");
  if (error) throw error;
  const storage = admin.storage.from("product-images");
  return data.map((p) => {
    const first = [...p.product_images].sort((a, b) => a.sort_order - b.sort_order)[0];
    const prices = p.product_variants.map((v) => v.price);
    return {
      id: p.id, name: p.name, isActive: p.is_active,
      thumbUrl: first ? storage.getPublicUrl(first.storage_path).data.publicUrl : null,
      minPrice: prices.length ? Math.min(...prices) : null,
    };
  });
}
