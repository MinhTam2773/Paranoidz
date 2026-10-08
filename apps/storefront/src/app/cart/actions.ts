"use server";

import { createAdminClient } from "@paranoidz/db/admin";
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

export type BundleEstimate = { amount: number; bundles: { name: string; sets: number }[] };

const MAX_UNITS = 20; // place_order() c_max_units: a bigger cart can't be ordered anyway

// Bundle discount the cart would get (ARCHITECTURE.md §5), from best_bundles() — the same search
// place_order() runs, never re-implemented here. Display only: at checkout the order gets the better
// of this and the voucher. Not capped at the subtotal (the caller does that). null = nothing to show.
export async function getBundleEstimate(lines: unknown): Promise<BundleEstimate | null> {
  if (!Array.isArray(lines) || !lines.length || lines.length > 50) return null;
  const valid = lines.filter(
    (l): l is { variantId: string; qty: number } => typeof l?.variantId === "string" && UUID.test(l.variantId) && Number.isInteger(l?.qty) && l.qty > 0,
  );
  if (valid.length !== lines.length || valid.reduce((n, l) => n + l.qty, 0) > MAX_UNITS) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.from("product_variants").select("id, product_id").in("id", valid.map((l) => l.variantId));
  if (error) throw error;
  const productOf = new Map(data.map((v) => [v.id, v.product_id]));
  const counts: Record<string, number> = {};
  for (const l of valid) {
    const product = productOf.get(l.variantId);
    if (product) counts[product] = (counts[product] ?? 0) + l.qty;
  }

  // service_role: best_bundles() is closed to browsers; its input is bounded above (≤ 20 units).
  const { data: result, error: rpcError } = await createAdminClient().rpc("best_bundles", { p_counts: counts });
  if (rpcError) throw rpcError;
  const { amount, bundles } = result as { amount: number; bundles: { name: string; sets: number }[] };
  return amount > 0 ? { amount, bundles: bundles.map(({ name, sets }) => ({ name, sets })) } : null;
}
