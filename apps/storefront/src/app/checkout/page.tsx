import type { Metadata } from "next";
import { CheckoutView } from "@/components/checkout/CheckoutView";
import { Breadcrumb } from "@/components/layout/Breadcrumb";

export const metadata: Metadata = { title: "Checkout | Paranoidz", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Buy It Now arrives as ?variant=<id>&qty=<n> and skips the cart (ARCHITECTURE.md §4);
// otherwise the order is the cart. Malformed params fall back to the cart.
export default async function CheckoutPage({ searchParams }: PageProps<"/checkout">) {
  const { variant, qty } = await searchParams;
  const n = Number(qty);
  const buyNow =
    typeof variant === "string" && UUID.test(variant) && Number.isInteger(n) && n >= 1 && n <= 20
      ? { variantId: variant, qty: n }
      : null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-6">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Cart", href: "/cart" }, { label: "Checkout" }]} />
      <h1 className="mb-6 text-h2 uppercase">Checkout</h1>
      <CheckoutView buyNow={buyNow} />
    </div>
  );
}
