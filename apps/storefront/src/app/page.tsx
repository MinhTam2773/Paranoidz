import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { createPublicClient } from "@paranoidz/db/public";
import { HomeTabs } from "@/components/home/HomeTabs";
import { Marquee, Lookbook } from "@/components/home/HomepageV2";
import { GachaSection } from "@/components/home/GachaSection";
import { Faq } from "@/components/home/Faq";
import { FlashSale } from "@/components/home/FlashSale";
import { Testimonials } from "@/components/home/Testimonials";
import { getFlashSaleState, flashPrice, type FlashSaleWindow } from "@/lib/flash-sale";
import { ProductRow } from "@/components/home/ProductRow";
import { HeroCarousel } from "@/components/home/HeroCarousel";
import { ProductCard, type ProductCardData } from "@/components/product/ProductCard";
import { productCardQuery, toProductCard } from "@/lib/catalog";

// Homepage (DESIGN.md §5 page structure, items 5–10). ISR like /products: rebuilt at most once a
// minute. Homepage v2 2026-10-16: video hero (shop's own TikTok clip) + marquee band +
// lookbook with real-life photos — inspired by hydrashop.vn / chuottrang.vn.
// No newsletter block — out of scope per ARCHITECTURE.md §9.
export const revalidate = 60;

// SEO (audit 2026-10-21 #2): the homepage previously had no H1 and a 9-character title.
// Title targets "áo thun local brand" + "streetwear Việt Nam"; the manifesto tagline below
// doubles as the page's single H1.
export const metadata: Metadata = {
  title: "Paranoidz — Áo thun local brand, streetwear Việt Nam",
  description:
    "Streetwear Việt Nam — thiết kế táo bạo, chất liệu nghiêm túc, giá không trên trời. Thanh toán khi nhận hàng (COD).",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Paranoidz — Áo thun local brand, streetwear Việt Nam",
    description:
      "Streetwear Việt Nam — thiết kế táo bạo, chất liệu nghiêm túc, giá không trên trời. Thanh toán khi nhận hàng (COD).",
    url: "/",
  },
};

const GRID_SIZE = 6;
const ROW_SIZE = 12;

export default async function HomePage() {
  const supabase = createPublicClient();
  // RLS: active products / collections only. Every active product is loaded once and the sections
  // are cut from it — fine at this catalog size.
  const [products, categories, collections, bestSellers, flashWindows] = await Promise.all([
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
    supabase.from("flash_sale_windows").select("start_hour, duration_minutes, discount_percent"),
  ]);
  for (const r of [products, categories, collections, bestSellers]) if (r.error) throw r.error;

  const cards = products.data!.map((p) => ({ card: toProductCard(supabase, p), categoryId: p.category_id }));
  const byId = new Map(cards.map(({ card }) => [card.id, card]));
  const newGoods = cards.slice(0, GRID_SIZE).map(({ card }) => card);
  const best = bestSellers.data!.flatMap(({ product_id }) => byId.get(product_id) ?? []);
  // Flash sale: extra discount on the selling price during an active window.
  const flashState = getFlashSaleState((flashWindows.data ?? []) as FlashSaleWindow[]);
  // Flash sale (option B, 2026-10-17): the discounted products are picked
  // server-side by public.flash_sale_picks() — deterministic per window, so the
  // homepage, checkout quote and place_order() all price the same 4 products.
  // Active window: picks at flash prices; otherwise a teaser of the next
  // window's picks at normal prices.
  const { data: pickIds } = flashState
    ? await supabase.rpc(
        "flash_sale_picks",
        flashState.active ? {} : { p_at: new Date(flashState.nextStartsAt).toISOString() },
      )
    : { data: null };
  const flashCards = ((pickIds ?? []) as string[])
    .map((id) => byId.get(id))
    .filter(
      (c): c is ProductCardData =>
        !!c && !c.soldOut && c.originalPrice !== null && c.originalPrice > c.price,
    )
    .map((c) =>
      flashState?.active && flashState.discountPercent > 0
        ? {
            ...c,
            // Stacked: flash price vs the TRUE original, so the badge shows the total % off.
            price: flashPrice(c.price, flashState.discountPercent),
            variants: c.variants.map((v) => ({
              ...v,
              original_price: v.original_price,
              price: flashPrice(v.price, flashState.discountPercent),
            })),
          }
        : c,
    );
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
      <HeroCarousel />
      <Marquee />
      <GachaSection />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-14 px-4 py-14 lg:gap-20 lg:px-6 lg:py-20">
        {collectionCards.length > 0 && (
          <section aria-label="Bộ sưu tập" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {collectionCards.slice(0, 2).map((c) => (
              <Link
                key={c.slug}
                href={`/collections/${c.slug}`}
                className="group relative aspect-[16/10] overflow-hidden bg-bg-dark"
              >
                {c.imageUrl && (
                  <Image
                    src={c.imageUrl}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    className="object-cover opacity-80 transition-all duration-300 group-hover:scale-[1.03] group-hover:opacity-100"
                  />
                )}
                <div className="absolute inset-0 bg-linear-to-t from-bg-dark/70 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5 uppercase text-text-on-dark">
                  <div>
                    <p className="text-h3">{c.name}</p>
                    <p className="text-caption opacity-70">{c.year}</p>
                  </div>
                  <span className="text-button opacity-0 transition-opacity duration-200 group-hover:opacity-100">Xem →</span>
                </div>
              </Link>
            ))}
          </section>
        )}

        <HomeTabs
          tabs={[
            { id: "new", label: "Hàng mới", content: <CardGrid cards={newGoods} empty="Chưa có sản phẩm nào." /> },
            { id: "best", label: "Bán chạy", content: <CardGrid cards={best} empty="Chưa có sản phẩm bán chạy." /> },
          ]}
        />

        {flashState && <FlashSale state={flashState} cards={flashCards} />}

        {categoryRows.map((row, i) => (
          <RowSection key={row.name} index={String(i + 2).padStart(2, "0")} title={row.name} href="/products">
            <ProductRow label={row.name}>
              {row.cards.map((card) => <ProductCard key={card.slug} product={card} />)}
            </ProductRow>
          </RowSection>
        ))}

        <Lookbook />

        {/* Dark manifesto — the Paranoidz edge (DESIGN.md: inverted sections ok). */}
        <section className="bg-bg-dark px-6 py-14 text-text-on-dark lg:px-12 lg:py-20">
          <p className="text-caption uppercase tracking-[0.14em] text-text-on-dark/60">Paranoidz</p>
          <p className="mt-4 max-w-3xl text-h2 uppercase leading-tight lg:text-h1 lg:leading-[1.1]">
            Mặc kệ thiên hạ.<br />Mặc đẹp cho chính mình.
          </p>
          <h1 className="mt-4 max-w-xl text-body text-text-on-dark/70">
            Streetwear Việt Nam — thiết kế táo bạo, chất liệu nghiêm túc, giá không trên trời.
          </h1>
        </section>

        <section className="grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-3">
          {[
            ["Thanh toán COD", "Nhận hàng rồi mới trả tiền"],
            ["SPX Express", "Giao hàng nhanh toàn quốc"],
            ["Đổi trả 7 ngày", "Nếu sản phẩm lỗi do shop"],
          ].map(([t, d]) => (
            <div key={t} className="bg-bg-primary p-6">
              <p className="text-nav font-bold uppercase">{t}</p>
              <p className="mt-1 text-caption text-text-secondary">{d}</p>
            </div>
          ))}
        </section>

        <Faq />

        <Testimonials />
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

// Numbered editorial section header (redesign 2026-10-16): replaces the old
// vertical-accent-bar style.
function RowSection({ index, title, href, children }: { index: string; title: string; href: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-8 flex items-end justify-between border-b border-border pb-4">
        <h2 className="text-h2 uppercase">
          <span className="mr-3 text-accent">{index}</span>
          {title}
        </h2>
        <Link href={href} className="shrink-0 text-nav uppercase text-text-secondary hover:text-text-primary">
          Xem tất cả →
        </Link>
      </div>
      {children}
    </section>
  );
}
