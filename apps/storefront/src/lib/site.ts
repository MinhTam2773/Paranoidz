// Site-wide content for the layout shell. Hardcoded until the client decides
// how it is managed (ARCHITECTURE.md §8.6, §8.7).

export const HOTLINE = "0345 267 709";

// Canonical production origin for SEO: metadataBase, sitemap, robots and canonical URLs.
// Deliberately NOT env-driven: Vercel preview deployments must canonicalise to production,
// otherwise every preview would compete with paranoidz.vn in search results.
export const SITE_URL = "https://paranoidz.vn";

// DESIGN.md §4, Row 2 — order matters.
export const NAV_LINKS = [
  { label: "Trang chủ", href: "/" },
  // Collections managed in the admin; these slugs must exist there (admin → Bộ sưu tập).
  // Their labels stay English: collection names (owner's decision, 2026-10-08).
  // Collection links (owner's decision 2026-10-27): T-Shirtz holds the
  // shirts, Backpackz holds the balo and túi. "Outlet 2026" replaced by
  // these two; "New collection" removed the same day because no collection
  // with slug "new-collection" exists in the admin, so the header linked
  // every visitor (and Googlebot) to a not-found page. Re-add a link only
  // when its collection is created in the admin.
  { label: "T-Shirtz", href: "/collections/t-shirtz" },
  { label: "Backpackz", href: "/collections/backpackz" },
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

// PLACEHOLDER — client to supply real profile URLs.
export const SOCIAL_LINKS = [
  { label: "Facebook", href: "#", icon: "facebook" },
  { label: "Instagram", href: "#", icon: "instagram" },
  { label: "TikTok", href: "#", icon: "tiktok" },
] as const;
