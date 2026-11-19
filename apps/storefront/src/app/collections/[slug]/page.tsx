import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createPublicClient } from "@paranoidz/db/public";
import { Prose } from "@/components/content/Prose";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ProductGrid } from "@/components/product/ProductGrid";
import { COLLECTION_COPY } from "@/content/collections";
import { productCardQuery, toProductCard } from "@/lib/catalog";
import { SITE_URL, breadcrumbJsonLd, websiteOpenGraph } from "@/lib/site";

// A collection set up in the admin (/collections there). ISR like product pages:
// prebuilt at deploy, rebuilt on demand or at most once a day; new slugs render on first visit.
// UI in Vietnamese (CLAUDE.md §5) though older storefront pages are still English.
export const revalidate = 86400;

export async function generateStaticParams() {
  const { data, error } = await createPublicClient().from("collections").select("slug");
  if (error) throw error;
  return data;
}

// RLS: active collections only, and items only of active collections; products
// only active ones — a hidden product simply drops out of the grid.
const getCollection = cache(async (slug: string) => {
  const supabase = createPublicClient();
  const { data: collection, error } = await supabase
    .from("collections")
    .select("name, description, collection_items(product_id, sort_order)")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!collection) return null;
  // Vietnamese name + SEO copy from content/collections.ts win over the admin's (owner, 2026-11-17).
  const copy = COLLECTION_COPY[slug] ?? null;
  const name = copy?.name ?? collection.name;

  const order = new Map(collection.collection_items.map((i) => [i.product_id, i.sort_order]));
  const ids = [...order.keys()];
  if (!ids.length) return { name, copy, description: collection.description, cards: [] };
  const { data: products, error: productsError } = await productCardQuery(supabase).in("id", ids);
  if (productsError) throw productsError;
  const cards = [...products]
    .sort((a, b) => order.get(a.id)! - order.get(b.id)!)
    .map((p) => toProductCard(supabase, p));
  return { name, copy, description: collection.description, cards };
});

export async function generateMetadata({ params }: PageProps<"/collections/[slug]">): Promise<Metadata> {
  const slug = (await params).slug;
  const collection = await getCollection(slug);
  if (!collection) return { title: "Không tìm thấy | Paranoidz" };
  // SEO (audit 2026-10-30): collections inherited the layout's generic description (shared by
  // 13 pages) and had no canonical. The admin's collection description wins when filled in.
  const title = collection.copy?.title ?? `${collection.name} | Paranoidz`;
  const description = collection.copy?.description || collection.description ||
    `Bộ sưu tập ${collection.name} của Paranoidz — streetwear Việt Nam, đổi trả 7 ngày, thanh toán khi nhận hàng (COD).`;
  return {
    title,
    description,
    alternates: { canonical: `/collections/${slug}` },
    openGraph: {
      ...websiteOpenGraph(`/collections/${slug}`),
      title,
      description,
    },
  };
}

export default async function CollectionPage({ params }: PageProps<"/collections/[slug]">) {
  const { slug } = await params;
  const collection = await getCollection(slug);
  if (!collection) notFound();

  const crumbs = [{ label: "Trang chủ", href: "/" }, { label: collection.name }];
  // SEO kit P2.6: the listed products, in the order shown, as an ItemList; plus the breadcrumb.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbJsonLd(crumbs, `/collections/${slug}`),
      ...(collection.cards.length
        ? [
            {
              "@type": "ItemList",
              "@id": `${SITE_URL}/collections/${slug}#itemlist`,
              name: collection.name,
              itemListElement: collection.cards.map((c, i) => ({
                "@type": "ListItem",
                position: i + 1,
                url: `${SITE_URL}/products/${c.slug}`,
                name: c.name,
              })),
            },
          ]
        : []),
    ],
  };

  const heading = (
    <>
      <h1 className="text-h2 uppercase">{collection.copy?.h1 ?? collection.name}</h1>
      {!collection.copy && collection.description && (
        <p className="mt-2 max-w-xl text-body text-text-secondary">{collection.description}</p>
      )}
      {/* /policy#terms: listed prices exclude VAT (SEO kit eeat/trust-signals.md). */}
      <p className="mt-2 text-caption text-text-muted">Giá chưa gồm VAT.</p>
    </>
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <Breadcrumb items={crumbs} />
      {collection.cards.length ? (
        <ProductGrid cards={collection.cards}>{heading}</ProductGrid>
      ) : (
        <>
          <div className="mb-6">{heading}</div>
          <p className="text-text-secondary">
            Bộ sưu tập này chưa có sản phẩm.{" "}
            <Link href="/products" className="text-text-primary underline underline-offset-4 hover:text-accent">Xem tất cả sản phẩm</Link>
          </p>
        </>
      )}
      {collection.copy && (
        <section aria-label={`Về bộ sưu tập ${collection.name}`} className="mt-12 max-w-3xl">
          <Prose source={collection.copy.intro} />
        </section>
      )}
      {slug === "t-shirtz" && (
        // SEO kit aeo/internal-links.md: the t-shirt collection is the hub for the guides.
        <nav aria-label="Tìm hiểu thêm" className="mt-12 flex flex-col gap-2 border-t border-border pt-6 text-body">
          <p className="text-nav font-bold uppercase text-text-primary">Tìm hiểu thêm</p>
          {[
            { label: "Hướng dẫn chọn size áo Paranoidz", href: "/huong-dan-chon-size" },
            { label: "Áo thun boxy và oversize khác nhau thế nào?", href: "/blog/ao-thun-boxy-va-oversize-khac-nhau" },
            { label: "Cách phối áo thun local brand", href: "/blog/cach-phoi-ao-thun-local-brand" },
            { label: "Paranoidz là gì?", href: "/branding" },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="w-fit text-text-primary underline underline-offset-4 hover:text-accent">
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
