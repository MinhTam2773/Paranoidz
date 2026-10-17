"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { formatVnd } from "@/lib/format";
import { QuickAdd } from "./QuickAdd";
import { WishlistButton } from "./WishlistButton";

export type ProductCardData = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  imageColor: string | null;
  price: number;
  originalPrice: number | null;
  soldOut: boolean;
  colors: { name: string; hex: string | null; imageUrl: string | null }[];
  variants: { id: string; color: string; size: string; price: number; original_price: number | null; stock: number }[];
  reviewCount: number;
  ratingAverage: number;
};

// DESIGN.md §4 product card (client reference 2026-10-12): borderless, rounded 3:4 image on
// bg-secondary with hover zoom, sale / sold-out badge top-right, heart + quick-add buttons bottom-right,
// colour dots, name, dual price, rating + express badge. Sold out (every variant at 0,
// ARCHITECTURE.md §3) replaces the sale badge and drops the cart button. The rating defaults
// to 5 stars (owner, 2026-10-17); real reviews take over from an average of 3 up (owner,
// 2026-10-12). A dot swaps the photo to that colour's first one; a colour without an admin-picked
// hex shows its name instead. `eager`: above-the-fold cards, so the LCP image isn't lazy-loaded.
// The buttons and dots sit beside the links, not inside them (a button inside <a> is invalid HTML);
// the image link is a mouse/touch shortcut only, the text link is the one in the tab order.
export function ProductCard({ product, eager = false }: { product: ProductCardData; eager?: boolean }) {
  const { id, name, slug, imageUrl, imageColor, price, originalPrice, soldOut, colors, variants, reviewCount, ratingAverage } = product;
  const [color, setColor] = useState(() => (colors.some((c) => c.name === imageColor) ? imageColor : null));
  const onSale = originalPrice !== null && originalPrice > price;
  // Scarcity cue (Chuột Trắng-style): any size down to its last few units.
  const lowStock = !soldOut && variants.some((v) => v.stock > 0 && v.stock <= 3);
  const href = `/products/${slug}`;
  const shownImage = colors.find((c) => c.name === color)?.imageUrl ?? imageUrl;
  // Only the shown photo loads until the card is hovered, touched or focused; from then on every
  // colour's photo is mounted underneath (hidden), so a dot swaps instantly instead of fetching on click.
  const [warm, setWarm] = useState(false);
  const images = warm ? [...new Set([shownImage, imageUrl, ...colors.map((c) => c.imageUrl)])] : [shownImage];

  return (
    <div className="group flex flex-col" onPointerEnter={() => setWarm(true)} onFocus={() => setWarm(true)}>
      <div className="relative aspect-square overflow-hidden rounded-sm bg-bg-secondary">
        <Link href={href} tabIndex={-1} aria-hidden className="absolute inset-0">
          {images.filter((src) => src !== null).map((src) => (
            <Image
              key={src}
              src={src}
              alt=""
              fill
              loading={eager || warm ? "eager" : undefined}
              sizes="(min-width: 1280px) 411px, (min-width: 1024px) 33vw, 50vw"
              className={`object-cover transition-[transform,opacity] duration-300 group-hover:scale-[1.04] ${src === shownImage ? "" : "opacity-0"}`}
            />
          ))}
        </Link>
        {/* Redesign 2026-10-16: badges top-left, wishlist top-right, quick-add as a
            full-width bar — always visible on touch, slides up on hover-capable devices. */}
        <div className="pointer-events-none absolute left-0 top-3 flex flex-col items-start gap-2">
          {soldOut ? (
            <span className="bg-bg-dark px-2.5 py-1 text-caption font-semibold uppercase tracking-[0.06em] text-text-on-dark">
              Hết hàng
            </span>
          ) : (
            <>
              {onSale && (
                <span className="bg-accent px-2.5 py-1 text-caption font-semibold uppercase tracking-[0.06em] text-text-on-dark">
                  -{Math.round(((originalPrice - price) / originalPrice) * 100)}%
                </span>
              )}
              {lowStock && (
                <span className="bg-warning px-2.5 py-1 text-caption font-semibold uppercase tracking-[0.06em] text-text-primary">
                  Sắp hết hàng
                </span>
              )}
            </>
          )}
        </div>
        <div className="absolute right-2 top-2">
          <WishlistButton productId={id} className="rounded-full bg-bg-primary/90 shadow-1 backdrop-blur-sm" />
        </div>
        {!soldOut && (
          <div className="absolute inset-x-0 bottom-0 hoverable:translate-y-full hoverable:transition-transform hoverable:duration-300 hoverable:group-hover:translate-y-0 hoverable:group-focus-within:translate-y-0">
            <QuickAdd product={product} color={color} onColor={setColor} barTrigger />
          </div>
        )}
      </div>
      {colors.length > 0 && (
        <ul aria-label="Màu sắc" className="-mx-1.5 mt-1 flex flex-wrap">
          {colors.map((c) => (
            <li key={c.name}>
              <button
                type="button"
                onClick={() => setColor(c.name)}
                aria-pressed={c.name === color}
                aria-label={c.hex ? c.name : undefined}
                className="flex h-11 min-w-11 items-center justify-center px-1.5"
              >
                {c.hex ? (
                  <span
                    className={`size-7 rounded-full border border-border ${c.name === color ? "ring-2 ring-text-primary ring-offset-2" : ""}`}
                    style={{ backgroundColor: c.hex }}
                  />
                ) : (
                  <span
                    className={`rounded-sm border px-2 py-1 text-caption ${c.name === color ? "border-text-primary text-text-primary" : "border-border text-text-secondary"}`}
                  >
                    {c.name}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      <Link href={href} className={`flex flex-1 flex-col gap-1.5 ${colors.length ? "pt-2" : "pt-3"}`}>
        <h2 className="line-clamp-2 text-[15px] font-medium leading-snug text-text-primary">{name}</h2>
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className={`text-[17px] font-bold tracking-[0.01em] ${onSale ? "text-accent" : "text-text-primary"}`}>{formatVnd(price)}</span>
          {onSale && <s className="text-[13px] text-text-muted">{formatVnd(originalPrice)}</s>}
        </p>
        {(() => {
          // Default 5 stars (owner 2026-10-17); real reviews take over when they exist.
          const hasReal = reviewCount > 0 && ratingAverage >= 3;
          const shown = hasReal ? ratingAverage : 5;
          return (
            <p className="flex w-fit flex-wrap items-center gap-1.5">
              <span className="flex items-center gap-1 rounded-sm border border-warning px-1.5 py-0.5 text-caption">
                <span aria-hidden className="text-warning">★★★★★</span>
                <span className="text-text-primary">{shown.toFixed(1).replace(".", ",")}</span>
                {hasReal && <span className="text-text-secondary">({reviewCount})</span>}
                <span className="sr-only">
                  {hasReal ? `điểm trung bình, ${reviewCount} đánh giá` : "đánh giá 5 sao"}
                </span>
              </span>
              <span className="flex items-center gap-1 rounded-sm bg-accent/10 px-1.5 py-0.5 text-caption font-medium text-accent">
                <span aria-hidden>⚡</span>Hoả tốc
              </span>
            </p>
          );
        })()}
      </Link>
    </div>
  );
}
