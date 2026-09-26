// Site-wide content for the layout shell. Hardcoded until the client decides
// how it is managed (ARCHITECTURE.md §8.6, §8.7).

export const HOTLINE = "0972 926 956";

// DESIGN.md §4, Row 2 — order matters.
export const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Outlet 2026", href: "/outlet" },
  { label: "New collection", href: "/new-collection" },
  { label: "Product", href: "/products" },
  { label: "Customer feedback", href: "/feedback" },
  { label: "Branding", href: "/branding" },
  { label: "Policy", href: "/policy" },
] as const;

export const POLICY_LINKS = [
  { label: "Shipping policy", href: "/policy#shipping" },
  { label: "Returns & exchanges", href: "/policy#returns" },
  { label: "Privacy policy", href: "/policy#privacy" },
] as const;

// PLACEHOLDER — client to supply real store addresses. Empty = column shows hotline only.
export const STORE_ADDRESSES: { name: string; address: string }[] = [];

// PLACEHOLDER — client to supply real profile URLs.
export const SOCIAL_LINKS = [
  { label: "Facebook", href: "#", icon: "facebook" },
  { label: "Instagram", href: "#", icon: "instagram" },
  { label: "TikTok", href: "#", icon: "tiktok" },
] as const;
