import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createPublicClient } from "@paranoidz/db/public";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { BundleOffers, getBundleOffers } from "@/components/product/BundleOffers";
import { ProductView } from "@/components/product/ProductView";
import { RecentlyViewed } from "@/components/product/RecentlyViewed";
import { ReviewSection, type ReviewData } from "@/components/product/ReviewSection";
import { SizeGuide, isSizeGuide } from "@/components/product/SizeGuide";
import { renderDescription } from "@/lib/sanitize-description";
import { SITE_URL } from "@/lib/site";

// ISR (ARCHITECTURE.md §2.2): every active product is prebuilt at deploy, then rebuilt at most once a
// minute; slugs added later render on first visit. Shown stock is display only — place_order() re-checks.
export const revalidate = 60;

export async function generateStaticParams() {
  const { data, error } = await createPublicClient().from("products").select("slug");
  if (error) throw error;
  return data;
}

// Shared by generateMetadata and the page: one query per render. RLS = active products only.
const getProduct = cache(async (slug: string) => {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, description, care_instructions, size_guide, product_variants(id, color, color_hex, size, price, original_price, stock), product_images(color, storage_path)",
    )
    .eq("slug", slug)
    .order("color", { referencedTable: "product_variants" })
    .order("sort_order", { referencedTable: "product_images" })
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { product_images, ...product } = data;
  return {
    ...product,
    images: product_images.map((i) => ({
      color: i.color,
      url: supabase.storage.from("product-images").getPublicUrl(i.storage_path).data.publicUrl,
    })),
  };
});

// Visible reviews + visible replies and photos only (RLS), newest review first, replies oldest first.
async function getReviews(productId: string): Promise<ReviewData[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("reviews")
    .select(
      "id, user_id, rating, content, author_name, created_at, review_replies(id, user_id, content, author_name, is_brand_reply, created_at), review_images(id, storage_path, sort_order)",
    )
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .order("created_at", { referencedTable: "review_replies" })
    .order("sort_order", { referencedTable: "review_images" });
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    userId: r.user_id,
    rating: r.rating,
    content: r.content,
    authorName: r.author_name,
    createdAt: r.created_at,
    photos: r.review_images.map((i) => ({
      id: i.id,
      url: supabase.storage.from("review-images").getPublicUrl(i.storage_path).data.publicUrl,
    })),
    replies: r.review_replies.map((p) => ({
      id: p.id,
      userId: p.user_id,
      content: p.content,
      authorName: p.author_name,
      isBrand: p.is_brand_reply,
      createdAt: p.created_at,
    })),
  }));
}

export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const slug = (await params).slug;
  const product = await getProduct(slug);
  if (!product) return { title: "Không tìm thấy | Paranoidz" };
  const title = `${shortTitle(product.name)} | Paranoidz`;
  const description = plainDescription(
    product.description,
    `${product.name} — Paranoidz. Thanh toán khi nhận hàng (COD).`,
  );
  const firstImage = product.images[0]?.url;
  return {
    title,
    description,
    alternates: { canonical: `/products/${slug}` },
    openGraph: {
      title,
      description,
      url: `/products/${slug}`,
      images: firstImage ? [{ url: firstImage }] : undefined,
    },
  };
}

// SEO (audit 2026-10-21 #3): product names run long (pdz01 hit 92 chars with the brand
// suffix and got cut off in search results). The name part is capped at 48 chars so the
// full title stays under 60; a trailing product code (pdz01, QT01, …) is kept because
// customers search by it, and the cut lands on a word boundary.
function shortTitle(name: string): string {
  const MAX_NAME = 48; // + " | Paranoidz" (12) = 60
  if (name.length <= MAX_NAME) return name;
  const code = name.match(/\s([A-Za-z]+\d+)$/)?.[1];
  const base = code ? name.slice(0, -code.length - 1) : name;
  const budget = MAX_NAME - (code ? code.length + 1 : 0) - 1; // -1 for "…"
  let cut = base.slice(0, budget);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > 20) cut = cut.slice(0, lastSpace);
  return `${cut}…${code ? ` ${code}` : ""}`;
}

// SEO (audit 2026-10-21 #4, #5): descriptions are stored as rich text, but meta
// descriptions and JSON-LD need plain text — strip tags, collapse whitespace, cap ~155
// chars on a word boundary so Google doesn't have to rewrite the snippet.
function plainDescription(html: string | null, fallback: string): string {
  const text = (html ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const src = text || fallback;
  if (src.length <= 155) return src;
  let cut = src.slice(0, 155);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > 100) cut = cut.slice(0, lastSpace);
  return `${cut}…`;
}

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const product = await getProduct((await params).slug);
  if (!product) notFound();
  const sizeGuide = isSizeGuide(product.size_guide) ? product.size_guide : null;
  const [offers, reviews] = await Promise.all([getBundleOffers(product.id), getReviews(product.id)]);
  const { slug } = await params;

  // SEO (audit 2026-10-21 #5): Product + BreadcrumbList structured data so Google can
  // show price and stock in rich results. Deliberately NO AggregateRating: the reviews tab
  // currently shows 0 reviews, and rating schema without visible reviews violates Google's
  // policy (audit #5). Add it only when real reviews are displayed on this page.
  const prices = [...new Set(product.product_variants.map((v) => v.price))].sort((a, b) => a - b);
  const inStock = product.product_variants.some((v) => v.stock > 0);
  const productUrl = `${SITE_URL}/products/${slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        name: product.name,
        image: product.images.map((i) => i.url),
        description: plainDescription(
          product.description,
          `${product.name} — Paranoidz. Thanh toán khi nhận hàng (COD).`,
        ),
        brand: { "@type": "Brand", name: "Paranoidz" },
        offers:
          prices.length === 1
            ? {
                "@type": "Offer",
                url: productUrl,
                priceCurrency: "VND",
                price: prices[0],
                availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                itemCondition: "https://schema.org/NewCondition",
              }
            : {
                "@type": "AggregateOffer",
                url: productUrl,
                priceCurrency: "VND",
                lowPrice: prices[0],
                highPrice: prices[prices.length - 1],
                offerCount: product.product_variants.length,
              },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Trang chủ", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Sản phẩm", item: `${SITE_URL}/products` },
          { "@type": "ListItem", position: 3, name: product.name },
        ],
      },
    ],
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Sản phẩm", href: "/products" }, { label: product.name }]} />
      <ProductView
        productId={product.id}
        name={product.name}
        variants={product.product_variants}
        images={product.images}
        details={
          (product.description || product.care_instructions) && (
            <div className="flex flex-col gap-8">
              {product.description && (
                <div className="flex flex-col gap-4">
                  <h2 className="text-nav font-bold uppercase">Mô tả</h2>
                  <div
                    className="desc-rich text-text-secondary"
                    dangerouslySetInnerHTML={{ __html: renderDescription(product.description) }}
                  />
                </div>
              )}
              {product.care_instructions && (
                <div className="flex flex-col gap-4">
                  <h2 className="text-nav font-bold uppercase">Hướng dẫn bảo quản</h2>
                  <p className="text-text-secondary">{product.care_instructions}</p>
                </div>
              )}
            </div>
          )
        }
        sizeGuide={sizeGuide && <SizeGuide guide={sizeGuide} />}
        bundles={<BundleOffers offers={offers} />}
        reviews={<ReviewSection productId={product.id} slug={slug} reviews={reviews} />}
        reviewCount={reviews.length}
      />
      <div className="mt-16">
        <RecentlyViewed excludeId={product.id} />
      </div>
    </div>
  );
}
