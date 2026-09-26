import type { Metadata } from "next";
import { createPublicClient } from "@paranoidz/db/public";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ProductCard } from "@/components/product/ProductCard";
import { productCardQuery, toProductCard } from "@/lib/catalog";

export const metadata: Metadata = { title: "All products | Paranoidz" };

// ISR (ARCHITECTURE.md §2.2): rebuilt at most once a minute. Shown stock may lag by that much —
// display only; place_order() re-checks stock atomically.
export const revalidate = 60;

export default async function ProductsPage() {
  const supabase = createPublicClient();
  const { data: products, error } = await productCardQuery(supabase)
    .order("created_at", { ascending: false })
    .order("name");
  if (error) throw error;
  const cards = products.map((p) => toProductCard(supabase, p));

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
