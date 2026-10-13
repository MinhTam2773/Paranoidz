"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useRef, useState, type MouseEvent } from "react";
import { BagPlusIcon, CloseIcon } from "@/components/layout/icons";
import { addToCart, useCart } from "@/lib/cart";
import { flyToCart } from "@/lib/fly-to-cart";
import { formatVnd } from "@/lib/format";
import type { ProductCardData } from "./ProductCard";
import { ColorOptions } from "./ColorOptions";
import { defaultSize, optionClass, sizeRank } from "./ProductView";
import { primaryClass } from "./PurchaseActions";

// The product card's cart button: colour + size picker in a native <dialog> (bottom sheet below
// 768px), adds one unit. The dialog closes before the fly-to-cart animation, which starts at this
// button (the top layer would hide the flyer). Same rules as the product page: stock-0 sizes can't
// be picked, the cart never holds more than the stock; place_order() re-checks atomically.
export function QuickAdd({
  product: { name, slug, imageUrl, colors, variants },
  color,
  onColor,
}: {
  product: ProductCardData;
  color: string | null; // the card's selected colour, kept in step with the sheet's
  onColor: (color: string) => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const thumbRef = useRef<HTMLImageElement>(null);
  const [size, setSize] = useState<string | null>(null);
  const cart = useCart();

  const sizes = variants.filter((v) => v.color === color).toSorted((a, b) => sizeRank(a.size) - sizeRank(b.size));
  const selected = sizes.find((v) => v.size === size && v.stock > 0) ?? null;
  const shown = selected ?? sizes.toSorted((a, b) => a.price - b.price)[0];
  const inCart = selected ? (cart.find((l) => l.variantId === selected.id)?.qty ?? 0) : 0;
  const full = selected !== null && inCart >= selected.stock;
  const thumb = colors.find((c) => c.name === color)?.imageUrl ?? imageUrl;

  function pickColor(next: string) {
    onColor(next);
    setSize(defaultSize(variants, next));
  }

  function open() {
    // The card's colour if it has one, else the first colour with stock (as the product page).
    const start = color ?? (variants.find((v) => v.stock > 0) ?? variants[0]).color;
    pickColor(start);
    dialogRef.current?.showModal();
  }

  function add() {
    if (!selected) return;
    dialogRef.current?.close();
    flyToCart(triggerRef.current!, thumbRef.current?.currentSrc, () => addToCart(selected.id, 1, selected.stock));
  }

  // A click on the dialog element itself (not its content) is a click on the backdrop.
  function onDialogClick(e: MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) dialogRef.current.close();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={open}
        aria-label={`Chọn size và thêm vào giỏ: ${name}`}
        className="flex size-11 items-center justify-center rounded-full bg-bg-primary text-text-primary shadow-1 transition-transform duration-200 hover:scale-110"
      >
        <BagPlusIcon width={22} height={22} />
      </button>
      <dialog
        ref={dialogRef}
        onClick={onDialogClick}
        aria-labelledby={titleId}
        className="mx-0 mb-0 mt-auto w-full max-w-none rounded-t-lg bg-bg-primary p-0 text-text-primary shadow-3 backdrop:bg-bg-dark/60 md:m-auto md:w-[calc(100%-2rem)] md:max-w-md md:rounded-sm"
      >
        <div className="flex max-h-[85dvh] flex-col gap-5 overflow-y-auto p-4 md:p-6">
          <div className="flex gap-3">
            <div className="relative aspect-3/4 w-20 shrink-0 overflow-hidden rounded-sm bg-bg-secondary">
              {thumb && <Image ref={thumbRef} src={thumb} alt="" fill sizes="80px" className="object-cover" />}
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <h2 id={titleId} className="line-clamp-2 text-product-name">{name}</h2>
              {shown && (
                <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className={`text-price ${shown.original_price && shown.original_price > shown.price ? "text-accent" : ""}`}>
                    {formatVnd(shown.price)}
                  </span>
                  {shown.original_price && shown.original_price > shown.price && (
                    <s className="text-price-old text-text-muted">{formatVnd(shown.original_price)}</s>
                  )}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Đóng"
              className="-mr-2 -mt-2 flex size-11 shrink-0 items-center justify-center"
            >
              <CloseIcon />
            </button>
          </div>

          <div role="group" aria-labelledby={`${titleId}-colour`} className="flex flex-col gap-3">
            <p id={`${titleId}-colour`} className="text-nav uppercase">
              Màu: <span className="text-text-secondary">{color}</span>
            </p>
            <ColorOptions colors={colors} selected={color} onPick={pickColor} />
          </div>

          <div role="group" aria-labelledby={`${titleId}-size`} className="flex flex-col gap-3">
            <p id={`${titleId}-size`} className="text-nav uppercase">Size</p>
            <div className="flex flex-wrap gap-2">
              {sizes.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={v.size === size}
                  disabled={v.stock === 0}
                  onClick={() => setSize(v.size)}
                  className={optionClass(v.size === size)}
                >
                  {v.size}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button type="button" disabled={!selected || full} onClick={add} className={`w-full ${primaryClass}`}>
              {selected ? "Thêm vào giỏ" : "Chọn size"}
            </button>
            {full && (
              <p role="status" className="text-caption text-text-secondary">
                Cả {selected.stock} sản phẩm còn lại đã có trong giỏ của bạn
              </p>
            )}
          </div>
          <Link href={`/products/${slug}`} className="self-center text-caption text-text-secondary underline hover:text-text-primary">
            Xem chi tiết sản phẩm
          </Link>
        </div>
      </dialog>
    </>
  );
}
