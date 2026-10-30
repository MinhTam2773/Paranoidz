import type { Metadata } from "next";
import { CartView } from "@/components/cart/CartView";
import { Breadcrumb } from "@/components/layout/Breadcrumb";

// noindex like checkout / account: a cart is per-visitor, never a search result.
export const metadata: Metadata = { title: "Giỏ hàng | Paranoidz", robots: { index: false } };

export default function CartPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-6">
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Giỏ hàng" }]} />
      <h1 className="mb-6 text-h2 uppercase">Giỏ hàng của bạn</h1>
      <CartView />
    </div>
  );
}
