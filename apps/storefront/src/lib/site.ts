// Site-wide content for the layout shell. Hardcoded until the client decides
// how it is managed (ARCHITECTURE.md §8.6, §8.7).

export const HOTLINE = "0972 926 956";

// DESIGN.md §4, Row 2 — order matters.
export const NAV_LINKS = [
  { label: "Trang chủ", href: "/" },
  // Collections managed in the admin; these slugs must exist there (admin → Bộ sưu tập).
  // Their labels stay English: collection names (owner's decision, 2026-10-08).
  { label: "Outlet 2026", href: "/collections/outlet-2026" },
  { label: "New collection", href: "/collections/new-collection" },
  { label: "Sản phẩm", href: "/products" },
  { label: "Đánh giá khách hàng", href: "/feedback" },
  { label: "Thương hiệu", href: "/branding" },
  { label: "Chính sách", href: "/policy" },
] as const;

export const POLICY_LINKS = [
  { label: "Chính sách giao hàng", href: "/policy#shipping" },
  { label: "Đổi trả", href: "/policy#returns" },
  { label: "Chính sách bảo mật", href: "/policy#privacy" },
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
