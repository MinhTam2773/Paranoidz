"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";
import { BagIcon } from "./icons";

// Header cart icon + red count badge (DESIGN.md §4). Client-side: the cart lives in localStorage.
export function CartLink() {
  const count = useCart().reduce((sum, l) => sum + l.qty, 0);

  return (
    <Link href="/cart" aria-label={`Cart, ${count} items`} className="relative flex size-11 items-center justify-center">
      <BagIcon />
      {count > 0 && (
        <span className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-accent text-caption text-text-on-dark">
          {count}
        </span>
      )}
    </Link>
  );
}
