import type { MetadataRoute } from "next";
import { createPublicClient } from "@paranoidz/db/public";
import { mediaUrl } from "@paranoidz/db/media";
import { SITE_URL } from "@/lib/site";

// SEO (audit 2026-10-21 #1): /sitemap.xml used to 404. Next.js serves this file's
// output at /sitemap.xml automatically. Only content pages are listed — transactional
// pages (cart, checkout, account) and search results are left out on purpose, so
// crawlers spend their budget on pages that should rank. RLS returns active products
// and collections only, same as the pages themselves.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createPublicClient();
  const [products, collections] = await Promise.all([
    supabase
      .from("products")
      .select("slug, updated_at, product_images(storage_path)")
      .order("sort_order", { referencedTable: "product_images" }),
    supabase.from("collections").select("slug, updated_at"),
  ]);
  if (products.error) throw products.error;
  if (collections.error) throw collections.error;
  // Audit 2026-10-30: lastModified is what Google actually reads (it ignores changeFrequency /
  // priority); the brand / policy / feedback pages are linked from every page but were missing.
  return [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/products`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    ...products.data.map((p) => ({
      url: `${SITE_URL}/products/${p.slug}`,
      lastModified: p.updated_at,
      changeFrequency: "weekly" as const,
      priority: 0.7,
      // Image sitemap entries (SEO kit P3.3): the product photos, so Google Images finds them.
      images: p.product_images.map((i) => mediaUrl("product-images", i.storage_path)),
    })),
    ...collections.data.map((c) => ({
      url: `${SITE_URL}/collections/${c.slug}`,
      lastModified: c.updated_at,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...[
      "/branding",
      "/feedback",
      "/policy",
      "/contact",
      "/huong-dan-chon-size",
      "/blog/ao-thun-boxy-va-oversize-khac-nhau",
      "/blog/cach-phoi-ao-thun-local-brand",
    ].map((path) => ({
      url: `${SITE_URL}${path}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
  ];
}
