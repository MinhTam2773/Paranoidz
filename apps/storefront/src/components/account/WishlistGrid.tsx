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
      {/* Same grid as /products. Each <li> is a grid cell so the card fills the column width and
          the row height — as a flex row it shrank to its content (name length set the width). */}
      {shown.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {shown.map((p) => (
            <li key={p.id} className="grid"><ProductCard product={p} /></li>
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
