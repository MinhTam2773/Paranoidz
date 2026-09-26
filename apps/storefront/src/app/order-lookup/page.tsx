import type { Metadata } from "next";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { OrderLookup } from "@/components/order/OrderLookup";
import { parseOrderNumber } from "@/lib/order-number";

export const metadata: Metadata = { title: "Order lookup | Paranoidz", robots: { index: false } };

// Guests' way back to an order (ARCHITECTURE.md §2.4). ?order= pre-fills the number (the checkout
// confirmation links here); the phone is never put in the URL.
export default async function OrderLookupPage({ searchParams }: PageProps<"/order-lookup">) {
  const { order } = await searchParams;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-6">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Order lookup" }]} />
      <h1 className="mb-6 text-h2 uppercase">Order lookup</h1>
      <OrderLookup defaultOrderNumber={(typeof order === "string" && parseOrderNumber(order)) || ""} />
    </div>
  );
}
