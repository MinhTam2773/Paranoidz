import {
  BundlesIcon,
  CollectionsIcon,
  CustomersIcon,
  DashboardIcon,
  GiftIcon,
  OrdersIcon,
  ProductsIcon,
  PromoIcon,
  ReviewsIcon,
} from "@/components/icons";

// DASHBOARD_DESIGN.md §4 — order matters. Labels double as page titles.
export const NAV_ITEMS = [
  { label: "Tổng quan", href: "/", icon: DashboardIcon },
  { label: "Đơn hàng", href: "/orders", icon: OrdersIcon },
  { label: "Sản phẩm", href: "/products", icon: ProductsIcon },
  { label: "Khách hàng", href: "/customers", icon: CustomersIcon },
  { label: "Combo", href: "/bundles", icon: BundlesIcon },
  { label: "Bộ sưu tập", href: "/collections", icon: CollectionsIcon },
  { label: "Mã giảm giá", href: "/promo-codes", icon: PromoIcon },
  { label: "Kho quà tặng", href: "/gift-pool", icon: GiftIcon },
  { label: "Đánh giá", href: "/reviews", icon: ReviewsIcon },
] as const;

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function pageTitle(pathname: string) {
  return NAV_ITEMS.find(({ href }) => isActive(pathname, href))?.label ?? "";
}

export const STORE_URL = "https://paranoidz.vn";
