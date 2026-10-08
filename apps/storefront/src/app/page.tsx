import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { createPublicClient } from "@paranoidz/db/public";
import { HomeTabs } from "@/components/home/HomeTabs";
import { ProductRow } from "@/components/home/ProductRow";
import { ProductCard, type ProductCardData } from "@/components/product/ProductCard";
import { productCardQuery, toProductCard } from "@/lib/catalog";
import heroImage from "../../public/hero.jpg";

// Homepage (DESIGN.md §5 page structure, items 5–10). ISR like /products: rebuilt at most once a
// minute. The hero is hardcoded until the CMS question (ARCHITECTURE.md §8.6) is settled; its photo
// is a dev placeholder (Unsplash). Below sm the 16:9 hero only fits the title + CTA (no subtitle).
// No newsletter block — out of scope per ARCHITECTURE.md §9.
export const revalidate = 60;

const GRID_SIZE = 6;
const ROW_SIZE = 12;

export default async function HomePage() {
  const supabase = createPublicClient();
  // RLS: active products / collections only. Every active product is loaded once and the sections
  // are cut from it — fine at this catalog size.
  const [products, categories, collections, bestSellers] = await Promise.all([
    productCardQuery(supabase).order("created_at", { ascending: false }).order("name"),
    supabase.from("categories").select("id, name").order("sort_order").order("name"),
    supabase
      .from("collections")
      .select("name, slug, created_at, collection_items(products(product_images(storage_path)))")
      .order("sort_order")
      .order("sort_order", { referencedTable: "collection_items" })
      .order("sort_order", { referencedTable: "collection_items.products.product_images" })
      .limit(1, { referencedTable: "collection_items.products.product_images" })
      .limit(4),
    supabase.rpc("best_seller_ids", { p_limit: GRID_SIZE }),
  ]);
  for (const r of [products, categories, collections, bestSellers]) if (r.error) throw r.error;

  const cards = products.data!.map((p) => ({ card: toProductCard(supabase, p), categoryId: p.category_id }));
  const byId = new Map(cards.map(({ card }) => [card.id, card]));
  const newGoods = cards.slice(0, GRID_SIZE).map(({ card }) => card);
  const best = bestSellers.data!.flatMap(({ product_id }) => byId.get(product_id) ?? []);
  const onSale = cards
    .map(({ card }) => card)
    .filter((c) => !c.soldOut && c.originalPrice !== null && c.originalPrice > c.price)
    .slice(0, ROW_SIZE);
  const categoryRows = categories
    .data!.map((c) => ({
      name: c.name,
      cards: cards.filter((x) => x.categoryId === c.id).slice(0, ROW_SIZE).map(({ card }) => card),
    }))
    .filter((c) => c.cards.length);
  // Card image = the first product in the collection that has a photo (collections have no image).
  const collectionCards = collections.data!.map((c) => {
    const path = c.collection_items.flatMap((i) => i.products?.product_images ?? [])[0]?.storage_path;
    return {
      name: c.name,
      slug: c.slug,
      year: c.created_at.slice(0, 4),
      imageUrl: path ? supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl : null,
    };
  });

  return (
    <>
      <section className="relative aspect-video w-full overflow-hidden bg-bg-dark lg:aspect-21/9">
        <Image src={heroImage} alt="" fill preload sizes="100vw" placeholder="blur" className="object-cover" />
        <div className="absolute inset-0 bg-linear-to-t from-bg-dark/70 via-bg-dark/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-7xl flex-col items-start gap-2 px-4 pb-4 text-text-on-dark sm:gap-3 sm:pb-6 lg:gap-4 lg:px-6 lg:pb-16">
          <h1 className="text-h1-mobile uppercase lg:text-h1">Bộ sưu tập mới 2026</h1>
          <p className="hidden opacity-80 sm:block">Những thiết kế mới nhất từ Paranoidz.</p>
          <Link
            href="/collections/new-collection"
            className="mt-1 flex h-12 items-center justify-center rounded-sm bg-accent px-8 text-button uppercase transition-all duration-200 hover:-translate-y-px hover:bg-accent-hover hover:shadow-accent"
          >
            Mua ngay
          </Link>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 py-12 lg:gap-16 lg:px-6 lg:py-16">
        {collectionCards.length > 0 && (
          <section aria-label="Bộ sưu tập" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {collectionCards.map((c) => (
              <Link
                key={c.slug}
                href={`/collections/${c.slug}`}
                className="group relative aspect-3/4 overflow-hidden rounded-sm bg-bg-dark"
              >
                {c.imageUrl && (
                  <Image
                    src={c.imageUrl}
                    alt=""
                    fill
                    sizes="(min-width: 1280px) 308px, (min-width: 1024px) 25vw, 50vw"
                    className="object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-0 bg-linear-to-t from-bg-dark/70 to-transparent to-60%" />
                <div className="absolute inset-x-0 bottom-0 p-4 uppercase text-text-on-dark">
                  <p className="text-h3">{c.name}</p>
                  <p className="text-caption opacity-80">{c.year}</p>
                  <p className="mt-2 translate-y-2 text-button opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
                    Mua ngay
                  </p>
                </div>
              </Link>
            ))}
          </section>
        )}

        <div className="flex flex-col gap-8">
          <HomeTabs
            tabs={[
              { id: "new", label: "Hàng mới", content: <CardGrid cards={newGoods} empty="Chưa có sản phẩm nào." /> },
              { id: "best", label: "Bán chạy", content: <CardGrid cards={best} empty="Chưa có sản phẩm bán chạy." /> },
            ]}
          />
          <Link
            href="/products"
            className="flex h-12 items-center justify-center self-center rounded-sm border border-text-primary px-8 text-button uppercase text-text-primary transition-colors duration-200 hover:bg-text-primary hover:text-text-on-dark"
          >
            Xem tất cả sản phẩm
          </Link>
        </div>

        {onSale.length > 0 && (
          <RowSection title="Sản phẩm đang khuyến mãi">
            <ProductRow label="Sản phẩm đang khuyến mãi">
              {onSale.map((card) => <ProductCard key={card.slug} product={card} />)}
            </ProductRow>
          </RowSection>
        )}

        {categoryRows.map((row) => (
          <RowSection key={row.name} title={row.name}>
            <ProductRow label={row.name}>
              {row.cards.map((card) => <ProductCard key={card.slug} product={card} />)}
            </ProductRow>
          </RowSection>
        ))}
      </div>
    </>
  );
}

function CardGrid({ cards, empty }: { cards: ProductCardData[]; empty: string }) {
  if (!cards.length) return <p className="text-center text-text-secondary">{empty}</p>;
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
      {cards.map((card) => <ProductCard key={card.slug} product={card} />)}
    </div>
  );
}

// Section title with the vertical accent bar (DESIGN.md §4 promotion / category sections).
function RowSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-6 border-l-4 border-accent pl-3 text-h2 uppercase">{title}</h2>
      {children}
    </section>
  );
}
