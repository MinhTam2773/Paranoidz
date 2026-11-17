// Site-wide content for the layout shell. Hardcoded until the client decides
// how it is managed (ARCHITECTURE.md §8.6, §8.7).

export const HOTLINE = "0345 267 709";

// Canonical production origin for SEO: metadataBase, sitemap, robots and canonical URLs.
// Deliberately NOT env-driven: Vercel preview deployments must canonicalise to production,
// otherwise every preview would compete with paranoidz.vn in search results.
export const SITE_URL = "https://paranoidz.vn";
export const SITE_NAME = "Paranoidz";
// The shop's people, as the owner wants them named in public (2026-11-17): byline, /contact.
export const TEAM_NAME = "Team Paranoidz";

// Share preview for pages without their own photo (home, listing, collections; SEO audit 2026-11-06).
// Product pages set their own og:image.
export const DEFAULT_OG_IMAGE = { url: "/og-default.jpg", width: 1200, height: 630, alt: "Paranoidz — streetwear Việt Nam" };

export function websiteOpenGraph(url: string) {
  return {
    url,
    siteName: SITE_NAME,
    locale: "vi_VN",
    type: "website" as const,
    images: [DEFAULT_OG_IMAGE],
  };
}

// BreadcrumbList JSON-LD mirroring the visible <Breadcrumb> (SEO kit aeo/schema-placement.md).
// The last crumb has no href in the UI; in the schema it points at the current page.
export function breadcrumbJsonLd(items: { label: string; href?: string }[], currentPath: string) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      item: `${SITE_URL}${c.href ?? currentPath}`,
    })),
  };
}

// DESIGN.md §4, Row 2 — order matters.
export const NAV_LINKS = [
  { label: "Trang chủ", href: "/" },
  // Collections managed in the admin; these slugs must exist there (admin → Bộ sưu tập).
  // Labels were English collection names (owner's decision, 2026-10-08); renamed to Vietnamese
  // with the slugs kept (owner, 2026-11-17, SEO kit content/collections.md).
  // Collection links (owner's decision 2026-10-27, order confirmed 2026-10-28):
  // header shows T-Shirtz, Backpackz, Bagz in this order; Accessoriez is
  // intentionally NOT shown in the header. "Outlet 2026" replaced by
  // T-Shirtz/Backpackz; "New collection" removed the same day because no
  // collection with slug "new-collection" exists in the admin, so the header
  // linked every visitor (and Googlebot) to a not-found page. Re-add a link
  // only when its collection is created in the admin.
  // Bagz added 2026-10-28, after its collection was created in the admin.
  { label: "Áo thun", href: "/collections/t-shirtz" },
  { label: "Balo", href: "/collections/backpackz" },
  { label: "Túi", href: "/collections/bagz" },
  { label: "Sản phẩm", href: "/products" },
  { label: "Đánh giá khách hàng", href: "/feedback" },
  { label: "Thương hiệu", href: "/branding" },
  { label: "Chính sách", href: "/policy" },
] as const;

export const POLICY_LINKS = [
  { label: "Điều kiện giao dịch", href: "/policy#terms" },
  { label: "Chính sách giao hàng", href: "/policy#shipping" },
  { label: "Đổi trả", href: "/policy#returns" },
  { label: "Thanh toán", href: "/policy#payment" },
  { label: "Chính sách bảo mật", href: "/policy#privacy" },
  { label: "Khiếu nại", href: "/policy#complaints" },
  { label: "Tra cứu đơn hàng", href: "/order-lookup" },
] as const;

// PLACEHOLDER — client to supply real store addresses. Empty = column shows hotline only.
export const STORE_ADDRESSES: { name: string; address: string }[] = [];

// Official channels (footer links supplied by Tủn 2026-10-16; Shopee shop already in the
// homepage schema). One source for the footer, mobile menu and Organization sameAs.
// Instagram dropped: no confirmed account. Other handles (.stu / .store) wait on the owner.
export const FACEBOOK_URL = "https://www.facebook.com/paranoidz.vn/";
export const TIKTOK_URL = "https://www.tiktok.com/@paranoidz.vn";
export const ZALO_URL = "https://zalo.me/0345267709";
export const SHOPEE_URL = "https://shopee.vn/paranoidz.studio";

export const SOCIAL_LINKS = [
  { label: "Facebook", href: FACEBOOK_URL, icon: "facebook" },
  { label: "TikTok", href: TIKTOK_URL, icon: "tiktok" },
] as const;

export const SAME_AS = [SHOPEE_URL, FACEBOOK_URL, TIKTOK_URL, ZALO_URL];

// Business details as printed in the footer and /policy (NAP for /contact and schema).
export const BUSINESS = {
  legalName: "Hộ kinh doanh COOLSHIRTZ",
  taxId: "042097005182",
  streetAddress: "57/41/17 Tô Hiệu, P. Phú Thạnh",
  locality: "TP. Hồ Chí Minh",
  email: "support@paranoidz.vn",
};
