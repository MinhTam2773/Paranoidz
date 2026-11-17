import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createPublicClient } from "@paranoidz/db/public";
import { mediaUrl } from "@paranoidz/db/media";
import { AsciiPageReveal } from "@/components/loading/AsciiPageReveal";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { BundleOffers, getBundleOffers } from "@/components/product/BundleOffers";
import { CUSTOMER_REVIEWS_DATA } from "@/components/product/customer-photos-data";
import { CustomerPhotos } from "@/components/product/CustomerPhotos";
import { ProductCard, type ProductCardData } from "@/components/product/ProductCard";
import { ProductView } from "@/components/product/ProductView";
import { RecentlyViewed } from "@/components/product/RecentlyViewed";
import { ReviewSection, type ReviewData } from "@/components/product/ReviewSection";
import { ShopeeReviews } from "@/components/product/ShopeeReviews";
import { SHOPEE_REVIEWS_DATA } from "@/components/product/shopee-reviews-data";
import { SizeGuide, isSizeGuide } from "@/components/product/SizeGuide";
import { productCardQuery, toProductCard } from "@/lib/catalog";
import { renderDescription } from "@/lib/sanitize-description";
import { SITE_NAME, SITE_URL } from "@/lib/site";

// ISR (ARCHITECTURE.md §2.2): every active product is prebuilt at deploy, then rebuilt on demand
// after orders and admin changes (api/revalidate), else at most once a day; slugs added later render
// on first visit. Shown stock is display only — place_order() re-checks.
export const revalidate = 86400;

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
      "id, name, description, care_instructions, size_guide, video_url, video_poster_url, product_variants(id, color, color_hex, size, price, original_price, stock), product_images(color, storage_path)",
    )
    .eq("slug", slug)
    .order("color", { referencedTable: "product_variants" })
    .order("sort_order", { referencedTable: "product_images" })
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { product_images, ...product } = data;
  const images = product_images.map((i) => ({
    color: i.color,
    url: mediaUrl("product-images", i.storage_path),
  }));
  return {
    ...product,
    images,
    video: product.video_url
      ? { url: product.video_url, poster: product.video_poster_url ?? images[0]?.url ?? null }
      : null,
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
      url: mediaUrl("review-images", i.storage_path),
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

// SEO kit 2026-11-17: the product's collection (t-shirtz first when it sits in several) drives
// the breadcrumb, the size-guide link and "Có thể bạn cũng thích". RLS: active collections
// and active products only, so a hidden product just drops out of the related row.
const getCollectionContext = cache(async (productId: string) => {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("collection_items")
    .select("collections(slug, name, collection_items(product_id, sort_order))")
    .eq("product_id", productId);
  if (error) throw error;
  const collections = data.flatMap((d) => (d.collections ? [d.collections] : []));
  const collection = collections.find((c) => c.slug === "t-shirtz") ?? collections[0];
  if (!collection) return null;
  const candidates = collection.collection_items
    .filter((i) => i.product_id !== productId)
    .toSorted((a, b) => a.sort_order - b.sort_order)
    .slice(0, 8)
    .map((i) => i.product_id);
  let related: ProductCardData[] = [];
  if (candidates.length) {
    const { data: products, error: productsError } = await productCardQuery(supabase).in("id", candidates);
    if (productsError) throw productsError;
    const order = new Map(candidates.map((id, i) => [id, i]));
    related = products
      .toSorted((a, b) => order.get(a.id)! - order.get(b.id)!)
      .slice(0, 4)
      .map((p) => toProductCard(supabase, p));
  }
  return { slug: collection.slug, name: collection.name, related };
});

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
      type: "website",
      siteName: SITE_NAME,
      locale: "vi_VN",
      images: firstImage ? [{ url: firstImage, alt: product.name }] : undefined,
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

const guideLink = "w-fit text-text-primary underline underline-offset-4 hover:text-accent";

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const product = await getProduct((await params).slug);
  if (!product) notFound();
  const sizeGuide = isSizeGuide(product.size_guide) ? product.size_guide : null;
  const [offers, reviews, collection] = await Promise.all([
    getBundleOffers(product.id),
    getReviews(product.id),
    getCollectionContext(product.id),
  ]);
  const { slug } = await params;
  // Product code is the slug's last segment; only products with curated data get the Shopee
  // block, the rest render exactly as before.
  const shopee = SHOPEE_REVIEWS_DATA[slug.split("-").pop() ?? ""];
  // Same key scheme for the customer review block (no marketplace
  // attribution); only products with curated reviews get it.
  const customerReviews = CUSTOMER_REVIEWS_DATA[slug.split("-").pop() ?? ""];

  // SEO (audit 2026-10-21 #5): Product + BreadcrumbList structured data so Google can
  // show price and stock in rich results. AggregateRating only from this site's visible
  // reviews (the "Đánh giá trên web" list below), never from the Shopee or curated photo
  // blocks: rating schema without those reviews on the page violates Google's policy.
  const prices = [...new Set(product.product_variants.map((v) => v.price))].sort((a, b) => a - b);
  const inStock = product.product_variants.some((v) => v.stock > 0);
  const productUrl = `${SITE_URL}/products/${slug}`;
  // Audit 2026-10-30: Google only lists a product as a Merchant listing when the offer carries
  // a return policy. Mirrors /policy#returns: 7 days, the shop books and pays the SPX pickup
  // (returns, 2026-11-13; exchanges stay by hotline and aren't described here).
  // shippingDetails is left out on purpose: the fee is SPX's live quote per address.
  const returnPolicy = {
    "@type": "MerchantReturnPolicy",
    applicableCountry: "VN",
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: 7,
    returnMethod: "https://schema.org/ReturnByMail",
    returnFees: "https://schema.org/FreeReturn",
    merchantReturnLink: `${SITE_URL}/policy#returns`,
    description: `Trả hàng trong 7 ngày kể từ khi nhận, hàng chưa dùng, còn nguyên tem mác. Cửa hàng gửi SPX lấy hàng và chịu phí vận chuyển trả hàng. Số tiền hoàn không gồm phí vận chuyển lúc gửi đi. Đổi size hoặc đổi mẫu: khách chịu phí vận chuyển phát sinh. Chi tiết: ${SITE_URL}/policy#returns`,
  };
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
        ...(reviews.length > 0 && {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10,
            reviewCount: reviews.length,
          },
          review: reviews.slice(0, 5).map((r) => ({
            "@type": "Review",
            reviewRating: { "@type": "Rating", ratingValue: r.rating },
            author: { "@type": "Person", name: r.authorName },
            datePublished: r.createdAt.slice(0, 10),
            reviewBody: r.content,
          })),
        }),
        offers:
          prices.length === 1
            ? {
                "@type": "Offer",
                url: productUrl,
                priceCurrency: "VND",
                price: prices[0],
                availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                itemCondition: "https://schema.org/NewCondition",
                hasMerchantReturnPolicy: returnPolicy,
              }
            : {
                "@type": "AggregateOffer",
                url: productUrl,
                priceCurrency: "VND",
                lowPrice: prices[0],
                highPrice: prices[prices.length - 1],
                offerCount: product.product_variants.length,
                hasMerchantReturnPolicy: returnPolicy,
              },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Trang chủ", item: SITE_URL },
          collection
            ? { "@type": "ListItem", position: 2, name: collection.name, item: `${SITE_URL}/collections/${collection.slug}` }
            : { "@type": "ListItem", position: 2, name: "Sản phẩm", item: `${SITE_URL}/products` },
          { "@type": "ListItem", position: 3, name: product.name, item: productUrl },
        ],
      },
    ],
  };

  return (
    // pb-28 clears the fixed sticky buy bar (up to ~84px tall): without it the
    // bar covers the last row of the recently-viewed rail at the page bottom.
    <AsciiPageReveal>
      <div className="mx-auto w-full max-w-7xl px-4 pb-28 lg:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <Breadcrumb
        items={[
          { label: "Trang chủ", href: "/" },
          collection
            ? { label: collection.name, href: `/collections/${collection.slug}` }
            : { label: "Sản phẩm", href: "/products" },
          { label: product.name },
        ]}
      />
      <ProductView
        productId={product.id}
        name={product.name}
        variants={product.product_variants}
        images={product.images}
        video={product.video}
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
        sizeGuide={
          sizeGuide && (
            <>
              <SizeGuide guide={sizeGuide} />
              {collection?.slug === "t-shirtz" && (
                // SEO kit aeo/internal-links.md: every t-shirt links the size guide and the form article.
                <div className="mt-4 flex flex-col gap-2">
                  <Link href="/huong-dan-chon-size" className={guideLink}>
                    Hướng dẫn chọn size
                  </Link>
                  <Link href="/blog/ao-thun-boxy-va-oversize-khac-nhau" className={guideLink}>
                    Form boxy và oversize khác nhau thế nào?
                  </Link>
                </div>
              )}
            </>
          )
        }
        bundles={<BundleOffers offers={offers} />}
        reviews={
          <div className="flex flex-col gap-8">
            {customerReviews && <CustomerPhotos reviews={customerReviews} />}
            {shopee && <ShopeeReviews totalRatings={shopee.totalRatings} reviews={shopee.featured} />}
            {shopee && <h2 className="text-nav font-bold uppercase">Đánh giá trên web</h2>}
            <ReviewSection productId={product.id} slug={slug} reviews={reviews} />
          </div>
        }
        reviewCount={reviews.length}
        shopeeReviewCount={shopee?.featured.length ?? 0}
        customerReviewCount={customerReviews?.length ?? 0}
      />
      {collection && collection.related.length > 0 && (
        <section aria-labelledby="related-products" className="mt-16">
          <h2 id="related-products" className="text-h2 mb-6 text-center">
            Có thể bạn cũng thích
          </h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {collection.related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
      <div className="mt-16">
        <RecentlyViewed excludeId={product.id} />
      </div>
      </div>
    </AsciiPageReveal>
  );
}
