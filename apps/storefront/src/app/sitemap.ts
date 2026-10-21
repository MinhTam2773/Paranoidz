import type { MetadataRoute } from "next";
import { createPublicClient } from "@paranoidz/db/public";
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
    supabase.from("products").select("slug"),
    supabase.from("collections").select("slug"),
  ]);
  if (products.error) throw products.error;
  if (collections.error) throw collections.error;
  return [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/products`, changeFrequency: "daily", priority: 0.8 },
    ...products.data.map((p) => ({
      url: `${SITE_URL}/products/${p.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...collections.data.map((c) => ({
      url: `${SITE_URL}/collections/${c.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
