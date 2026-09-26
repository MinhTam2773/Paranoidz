"use server";

import { createClient } from "@paranoidz/db/server";

export type CartItem = {
  variantId: string;
  slug: string;
  name: string;
  color: string;
  size: string;
  price: number;
  originalPrice: number | null;
  stock: number;
  imageUrl: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Current name/price/stock/image for the variant ids in the browser's cart. Public catalog data
// only (RLS: active products); read server-side per ARCHITECTURE.md §2.2. Display only —
// the order route recomputes prices. Ids of inactive/deleted variants are simply absent.
export async function getCartItems(variantIds: unknown): Promise<CartItem[]> {
  const ids = Array.isArray(variantIds) ? variantIds.filter((id) => typeof id === "string" && UUID.test(id)).slice(0, 50) : [];
  if (!ids.length) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_variants")
    .select("id, color, size, price, original_price, stock, products(name, slug, product_images(color, storage_path, sort_order))")
    .in("id", ids);
  if (error) throw error;

  return data.map((v) => {
    const images = v.products.product_images.toSorted((a, b) => a.sort_order - b.sort_order);
    // The colourway's own photo, else the first general one.
    const image = images.find((i) => i.color === v.color) ?? images[0];
    return {
      variantId: v.id,
      slug: v.products.slug,
      name: v.products.name,
      color: v.color,
      size: v.size,
      price: v.price,
      originalPrice: v.original_price,
      stock: v.stock,
      imageUrl: image ? supabase.storage.from("product-images").getPublicUrl(image.storage_path).data.publicUrl : null,
    };
  });
}
