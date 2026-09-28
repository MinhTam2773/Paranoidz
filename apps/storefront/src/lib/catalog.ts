import { createPublicClient } from "@paranoidz/db/public";
import type { ProductCardData } from "@/components/product/ProductCard";

type PublicClient = ReturnType<typeof createPublicClient>;

// Product rows for ProductCard (catalog + search). RLS returns active products only. Callers add
// their own filter / order.
export function productCardQuery(supabase: PublicClient) {
  return supabase
    .from("products")
    .select("id, name, slug, product_variants(price, original_price, stock), product_images(storage_path)")
    .order("sort_order", { referencedTable: "product_images" })
    .limit(1, { referencedTable: "product_images" });
}

// search_products() hits as ranked cards (search page, header suggestions); the first `limit` only.
export async function searchProductCards(supabase: PublicClient, query: string, limit?: number) {
  const { data: hits, error } = await supabase.rpc("search_products", { p_query: query });
  if (error) throw error;
  const ids = hits.slice(0, limit).map((h) => h.product_id);
  if (!ids.length) return [];
  const { data: rows, error: rowsError } = await productCardQuery(supabase).in("id", ids);
  if (rowsError) throw rowsError;
  const rank = new Map(ids.map((id, i) => [id, i]));
  return rows.toSorted((a, b) => rank.get(a.id)! - rank.get(b.id)!).map((p) => toProductCard(supabase, p));
}

type CardRow = NonNullable<Awaited<ReturnType<typeof productCardQuery>>["data"]>[number];

export function toProductCard(supabase: PublicClient, p: CardRow): ProductCardData {
  const inStock = p.product_variants.filter((v) => v.stock > 0);
  // Cheapest variant the customer can actually buy; any variant once sold out.
  const [cheapest] = (inStock.length ? inStock : p.product_variants).toSorted((a, b) => a.price - b.price);
  const image = p.product_images[0];
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    imageUrl: image ? supabase.storage.from("product-images").getPublicUrl(image.storage_path).data.publicUrl : null,
    price: cheapest?.price ?? 0,
    originalPrice: cheapest?.original_price ?? null,
    soldOut: inStock.length === 0,
  };
}
