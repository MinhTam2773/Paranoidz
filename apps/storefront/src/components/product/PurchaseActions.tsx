"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent, type RefObject } from "react";
import { addToCart } from "@/lib/cart";
import { flyToCart } from "@/lib/fly-to-cart";
import type { ProductVariant } from "./ProductView";
import { QuantityStepper } from "./QuantityStepper";

const primaryClass =
  "h-12 rounded-sm bg-accent px-4 text-button uppercase text-text-on-dark transition-all duration-200 enabled:hover:-translate-y-px enabled:hover:bg-accent-hover enabled:hover:shadow-accent disabled:cursor-not-allowed disabled:bg-bg-tertiary disabled:text-text-muted";

// Quantity + ADD TO CART / BUY IT NOW for the selected variant, plus the mobile sticky bar
// (DESIGN.md §8) shown while the inline buttons are off-screen. Buy It Now skips the cart
// (ARCHITECTURE.md §4). Quantities are capped at stock here; place_order() re-checks atomically.
export function PurchaseActions({
  variant,
  soldOut,
  price,
  imageRef,
  onNeedSize,
}: {
  variant: ProductVariant | null;
  soldOut: boolean;
  price: string;
  imageRef: RefObject<HTMLImageElement | null>; // the displayed main image, flown to the cart
  onNeedSize: () => void;
}) {
  const router = useRouter();
  // Both reset when the selected variant changes (derived, no effect needed).
  const [qtyState, setQtyState] = useState<{ id?: string; qty: number }>({ qty: 1 });
  const qty = variant && qtyState.id === variant.id ? qtyState.qty : 1;
  const [notice, setNotice] = useState<{ id: string; text: string; added: boolean } | null>(null);
  const message = variant && notice?.id === variant.id ? notice : null;

  const inlineRef = useRef<HTMLDivElement>(null);
  const [showBar, setShowBar] = useState(false);
  useEffect(() => {
    // Bar only while neither the inline buttons nor the footer are on screen (it would cover the footer).
    const targets = [inlineRef.current, document.querySelector("footer")].filter((el) => el !== null);
    const onScreen = new Map<Element, boolean>();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => onScreen.set(e.target, e.isIntersecting));
      setShowBar(![...onScreen.values()].some(Boolean));
    });
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  function add(e: MouseEvent<HTMLButtonElement>) {
    if (!variant) return;
    const added = flyToCart(e.currentTarget, imageRef.current?.currentSrc, () =>
      addToCart(variant.id, qty, variant.stock),
    );
    setNotice({
      id: variant.id,
      added: added > 0,
      text:
        added === qty
          ? "Added to cart"
          : added > 0
            ? `Added ${added} — only ${variant.stock} in stock`
            : `All ${variant.stock} in stock are already in your cart`,
    });
  }

  function buyNow() {
    if (variant) router.push(`/checkout?variant=${variant.id}&qty=${qty}`);
  }

  const status = message && (
    <p role="status" className="text-caption text-text-secondary">
      {message.text}
      {message.added && (
        <>
          {" · "}
          <Link href="/cart" className="text-text-primary underline">
            View cart
          </Link>
        </>
      )}
    </p>
  );

  if (soldOut) {
    return (
      <button type="button" disabled className="h-12 w-full rounded-sm bg-bg-tertiary text-button uppercase text-text-muted">
        Sold out
      </button>
    );
  }

  return (
    <>
      <div ref={inlineRef} className="flex flex-col gap-3">
        <div className="flex gap-3">
          <QuantityStepper
            value={qty}
            max={variant?.stock ?? 1}
            onChange={(n) => variant && setQtyState({ id: variant.id, qty: n })}
          />
          <button type="button" disabled={!variant} onClick={add} className={`flex-1 ${primaryClass}`}>
            {variant ? "Add to cart" : "Select a size"}
          </button>
        </div>
        <button
          type="button"
          disabled={!variant}
          onClick={buyNow}
          className="h-12 w-full rounded-sm border border-text-primary text-button uppercase text-text-primary transition-colors duration-200 enabled:hover:bg-text-primary enabled:hover:text-text-on-dark disabled:cursor-not-allowed disabled:border-border disabled:text-text-muted"
        >
          Buy it now
        </button>
        {status}
      </div>

      <div
        inert={!showBar}
        className={`fixed inset-x-0 bottom-0 z-30 flex flex-col gap-2 border-t border-border bg-bg-primary px-4 py-3 transition-transform duration-200 lg:hidden ${
          showBar ? "shadow-2" : "translate-y-full"
        }`}
      >
        {status}
        <div className="flex items-center gap-3">
          <span className="flex-1 text-price">{price}</span>
          {/* No size yet: jump to the size picker instead of a dead disabled button. */}
          <button type="button" onClick={variant ? add : onNeedSize} className={`flex-1 ${primaryClass}`}>
            {variant ? "Add to cart" : "Select a size"}
          </button>
        </div>
      </div>
    </>
  );
}
