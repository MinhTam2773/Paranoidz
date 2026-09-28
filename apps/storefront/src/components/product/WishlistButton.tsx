"use client";

import { openLogin } from "@/components/auth/LoginModal";
import { HeartIcon } from "@/components/layout/icons";
import { setPendingWishlist, toggleWishlist, useWishlist } from "@/lib/wishlist";

// Heart toggle. Guests get the login modal; the tap is remembered and applied once they're in.
export function WishlistButton({ productId, className = "" }: { productId: string; className?: string }) {
  const { status, ids } = useWishlist();
  const saved = ids.has(productId);

  function onClick() {
    if (status === "guest") {
      setPendingWishlist(productId);
      return openLogin();
    }
    void toggleWishlist(productId);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={status === "loading"}
      aria-pressed={saved}
      aria-label={saved ? "Remove from wishlist" : "Add to wishlist"}
      className={`flex size-11 items-center justify-center rounded-sm text-text-primary transition-transform duration-200 enabled:hover:scale-110 disabled:opacity-50 ${className}`}
    >
      <HeartIcon width={22} height={22} fill={saved ? "currentColor" : "none"} />
    </button>
  );
}
