"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent, type RefObject } from "react";
import { addToCart } from "@/lib/cart";
import { flyToCart } from "@/lib/fly-to-cart";
import type { ProductVariant } from "./ProductView";
import { QuantityStepper } from "./QuantityStepper";

export const primaryClass =
  "h-12 rounded-sm bg-accent px-4 text-button uppercase text-text-on-dark transition-all duration-200 enabled:hover:-translate-y-px enabled:hover:bg-accent-hover enabled:hover:shadow-accent disabled:cursor-not-allowed disabled:bg-bg-tertiary disabled:text-text-muted";

// Quantity + ADD TO CART / BUY IT NOW for the selected variant, plus the sticky buy bar
// (DESIGN.md §8, Hydra-style): thumbnail + name + variant + price + add button, shown on every
// screen size while the inline buttons are off-screen (and the footer isn't). Buy It Now skips
// the cart (ARCHITECTURE.md §4). Quantities are capped at stock here; place_order() re-checks
// atomically.
export function PurchaseActions({
  variant,
  soldOut,
  price,
  name,
  thumbnailUrl,
  imageRef,
  onNeedSize,
}: {
  variant: ProductVariant | null;
  soldOut: boolean;
  price: string;
  name: string;
  thumbnailUrl: string | null;
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
          ? "Đã thêm vào giỏ"
          : added > 0
            ? `Đã thêm ${added} — chỉ còn ${variant.stock} sản phẩm`
            : `Cả ${variant.stock} sản phẩm còn lại đã có trong giỏ của bạn`,
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
            Xem giỏ hàng
          </Link>
        </>
      )}
    </p>
  );

  if (soldOut) {
    return (
      <button type="button" disabled className="h-12 w-full rounded-sm bg-bg-tertiary text-button uppercase text-text-muted">
        Hết hàng
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
            {variant ? "Thêm vào giỏ" : "Chọn size"}
          </button>
        </div>
        <button
          type="button"
          disabled={!variant}
          onClick={buyNow}
          className="h-12 w-full rounded-sm border border-text-primary text-button uppercase text-text-primary transition-colors duration-200 enabled:hover:bg-text-primary enabled:hover:text-text-on-dark disabled:cursor-not-allowed disabled:border-border disabled:text-text-muted"
        >
          Mua ngay
        </button>
        {status}
      </div>

      <div
        inert={!showBar}
        className={`fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg-primary/95 backdrop-blur transition-transform duration-200 ${
          showBar ? "shadow-2" : "translate-y-full"
        }`}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3 lg:gap-4 lg:px-6">
          {thumbnailUrl && (
            <img src={thumbnailUrl} alt="" aria-hidden className="hidden size-14 shrink-0 rounded-sm bg-bg-secondary object-cover sm:block" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium text-text-primary">{name}</p>
            <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
              <span className="text-price">{price}</span>
              {variant ? (
                <span className="truncate text-caption text-text-secondary">
                  {variant.color} / {variant.size}
                </span>
              ) : (
                <span className="text-caption text-text-secondary">Chọn màu và size</span>
              )}
            </p>
          </div>
          {/* No size yet: jump to the size picker instead of a dead disabled button. */}
          <button type="button" onClick={variant ? add : onNeedSize} className={`shrink-0 ${primaryClass}`}>
            {variant ? "Thêm vào giỏ" : "Chọn size"}
          </button>
        </div>
        {status && <div className="mx-auto w-full max-w-7xl px-4 pb-2 lg:px-6">{status}</div>}
      </div>
    </>
  );
}
