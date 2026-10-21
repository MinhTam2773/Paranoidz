import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// SEO (audit 2026-10-21 #1): /robots.txt used to 404. Next.js serves this file's
// output at /robots.txt automatically. Everything is crawlable except /api/ — API
// routes (SPX webhook included) are not content pages and must not be indexed.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: "/api/" }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
