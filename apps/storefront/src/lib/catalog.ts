import { createPublicClient } from "@paranoidz/db/public";
import type { ProductCardData } from "@/components/product/ProductCard";

type PublicClient = ReturnType<typeof createPublicClient>;

// Product rows for ProductCard (catalog + search). RLS returns active products only; the ratings are
// visible reviews only (a signed-in author also sees their own hidden one). All images come along
// so each colour dot can show its own photo. Callers add their own filter / order.
export function productCardQuery(supabase: PublicClient) {
  return supabase
    .from("products")
    .select("id, name, slug, category_id, product_variants(price, original_price, stock, color, color_hex), product_images(storage_path, color), reviews(rating)")
    .eq("reviews.is_visible", true)
    .order("sort_order", { referencedTable: "product_images" });
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
  const imageUrl = (path: string) => supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
  const image = p.product_images[0];
  const reviewCount = p.reviews.length;
  // One dot per colour: the first non-null hex (a size added later has none yet) and the colour's
  // first photo, sorted by name like the admin's colour list.
  const colors = [...new Set(p.product_variants.map((v) => v.color))].toSorted((a, b) => a.localeCompare(b, "vi")).map((name) => {
    const photo = p.product_images.find((i) => i.color === name);
    return {
      name,
      hex: p.product_variants.find((v) => v.color === name && v.color_hex)?.color_hex ?? null,
      imageUrl: photo ? imageUrl(photo.storage_path) : null,
    };
  });
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    imageUrl: image ? imageUrl(image.storage_path) : null,
    imageColor: image?.color ?? null,
    price: cheapest?.price ?? 0,
    originalPrice: cheapest?.original_price ?? null,
    soldOut: inStock.length === 0,
    colors,
    reviewCount,
    ratingAverage: reviewCount ? p.reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount : 0,
  };
}
