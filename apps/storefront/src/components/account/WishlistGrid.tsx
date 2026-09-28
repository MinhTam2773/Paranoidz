"use client";

import Link from "next/link";
import { ProductCard, type ProductCardData } from "@/components/product/ProductCard";
import { useWishlist } from "@/lib/wishlist";

// Account wishlist (Stitch "User Profile" WISHLIST), as product cards: the heart on each card
// removes it, and the card disappears as soon as the store drops it — no page refresh. Adding to
// cart needs a size, so the card opens the product page instead of Stitch's ADD TO CART button.
export function WishlistGrid({ products }: { products: ProductCardData[] }) {
  const { status, ids } = useWishlist();
  const shown = status === "ready" ? products.filter((p) => ids.has(p.id)) : products;

  return (
    <section aria-labelledby="wishlist" className="flex flex-col gap-4">
      <h2 id="wishlist" className="text-h3 uppercase">Wishlist</h2>
      {shown.length ? (
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
          {shown.map((p) => (
            <li key={p.id} className="flex"><ProductCard product={p} /></li>
          ))}
        </ul>
      ) : (
        <p className="text-text-secondary">
          Nothing saved yet. Tap the heart on any product to keep it here.{" "}
          <Link href="/products" className="text-text-primary underline underline-offset-4 hover:text-accent">Browse products</Link>
        </p>
      )}
    </section>
  );
}
