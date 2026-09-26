import type { Metadata } from "next";
import { createPublicClient } from "@paranoidz/db/public";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ProductCard, type ProductCardData } from "@/components/product/ProductCard";

export const metadata: Metadata = { title: "All products | Paranoidz" };

// ISR (ARCHITECTURE.md §2.2): rebuilt at most once a minute. Shown stock may lag by that much —
// display only; place_order() re-checks stock atomically.
export const revalidate = 60;

export default async function ProductsPage() {
  const supabase = createPublicClient();
  // RLS returns active products only.
  const { data: products, error } = await supabase
    .from("products")
    .select("name, slug, product_variants(price, original_price, stock), product_images(storage_path)")
    .order("created_at", { ascending: false })
    .order("name")
    .order("sort_order", { referencedTable: "product_images" })
    .limit(1, { referencedTable: "product_images" });
  if (error) throw error;

  const cards: ProductCardData[] = products.map((p) => {
    const inStock = p.product_variants.filter((v) => v.stock > 0);
    // Cheapest variant the customer can actually buy; any variant once sold out.
    const [cheapest] = (inStock.length ? inStock : p.product_variants).toSorted((a, b) => a.price - b.price);
    const image = p.product_images[0];
    return {
      name: p.name,
      slug: p.slug,
      imageUrl: image ? supabase.storage.from("product-images").getPublicUrl(image.storage_path).data.publicUrl : null,
      price: cheapest?.price ?? 0,
      originalPrice: cheapest?.original_price ?? null,
      soldOut: inStock.length === 0,
    };
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-6">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Product" }]} />
      <h1 className="mb-6 text-h2 uppercase">All products</h1>
      {cards.length ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {cards.map((card, i) => (
            <ProductCard key={card.slug} product={card} eager={i < 3} />
          ))}
        </div>
      ) : (
        <p className="text-text-secondary">No products yet.</p>
      )}
    </div>
  );
}
