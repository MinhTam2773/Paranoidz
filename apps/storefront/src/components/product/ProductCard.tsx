"use client";

import Link, { useLinkStatus } from "next/link";
import { useState } from "react";
import { formatVnd } from "@/lib/format";
import { WishlistButton } from "./WishlistButton";
import { ThumbImage } from "@/components/product/ThumbImage";

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
  shopeeSoldCount: number;
  giftLabel: string | null;
};

// DESIGN.md §4 product card (client reference 2026-10-12): borderless, rounded 3:4 image on
// bg-secondary with hover zoom, sale / sold-out badge top-right, heart bottom-right,
// colour thumbnails below the photo, name, dual price, rating + express badge. Sold out (every variant at 0,
// ARCHITECTURE.md §3) replaces the sale badge and drops the cart button. The rating defaults
// to 5 stars (owner, 2026-10-17); real reviews take over from an average of 3 up (owner,
// 2026-10-12). A thumbnail swaps the photo to that colour's first one and names the colour
// on hover; a colour without its own photo keeps the old dot (hex) or name chip.
// `eager`: above-the-fold cards, so the LCP image isn't lazy-loaded.
// The buttons and thumbnails sit beside the links, not inside them (a button inside <a> is invalid HTML);
// the image link is a mouse/touch shortcut only, the text link is the one in the tab order.
// Shown on the tapped card while its navigation is pending. Same-segment
// navigation (PDP -> PDP) keeps the old page visible until the new one is
// ready, so without this a tap looks dead for the whole server round-trip.
function PendingVeil() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span className="absolute inset-0 z-10 flex items-center justify-center bg-bg-primary/60">
      <span className="size-8 animate-spin rounded-full border-2 border-border border-t-text-primary" />
    </span>
  );
}

export function ProductCard({ product, eager = false }: { product: ProductCardData; eager?: boolean }) {
  const { id, name, slug, imageUrl, imageColor, price, originalPrice, soldOut, colors, variants, reviewCount, ratingAverage, shopeeSoldCount, giftLabel } = product;
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
          <PendingVeil />
          {images.filter((src) => src !== null).map((src) => (
            <ThumbImage
              key={src}
              src={src}
              thumb={600}
              alt=""
              fill
              loading={eager || warm ? "eager" : undefined}
              sizes="(min-width: 1280px) 411px, (min-width: 1024px) 33vw, 50vw"
              className={`object-cover transition-[transform,opacity] duration-300 group-hover:scale-[1.04] ${src === shownImage ? "" : "opacity-0"}`}
            />
          ))}
        </Link>
        {/* Redesign 2026-10-16: badges top-left, wishlist top-right. No quick-add:
            the card stays clean; buying happens on the product page. */}
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
      </div>
      {colors.length > 0 && (
        // One row always (owner 2026-10-20): colour chips never wrap — the row scrolls
        // horizontally instead (2026-10-25: 6+ colourways overflowed narrow cards).
        // The wrapper carries the scroll + top padding: the hover tooltip sits ~30px above
        // its thumb, and a scroll container would clip it without that clearance.
        // The tooltip uses peer/peer-hover, NOT group: the card root is already `group`
        // (hover zoom), so group-hover would show every tooltip at once.
        <div className="-mx-1 overflow-x-auto pt-8">
          <ul aria-label="Màu sắc" className="flex flex-nowrap">
          {colors.map((c) => (
            <li key={c.name} className="relative min-w-0">
              {c.imageUrl ? (
                <>
                  <button
                    type="button"
                    onClick={() => setColor(c.name)}
                    aria-pressed={c.name === color}
                    aria-label={c.name}
                    className="peer flex h-11 items-center justify-center px-1"
                  >
                    <span
                      className={`block size-9 overflow-hidden rounded-sm border ${
                        c.name === color ? "border-transparent ring-2 ring-text-primary ring-offset-2" : "border-border"
                      }`}
                    >
                      <ThumbImage src={c.imageUrl} thumb={120} alt="" width={36} height={36} className="size-full object-cover" />
                    </span>
                  </button>
                  <span className="pointer-events-none absolute -top-1 left-1/2 z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-sm border border-border bg-bg-primary px-2 py-1 text-caption opacity-0 shadow-1 transition-opacity peer-hover:opacity-100">
                    {c.name}
                  </span>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setColor(c.name)}
                  aria-pressed={c.name === color}
                  aria-label={c.hex ? c.name : undefined}
                  className={`flex h-11 max-w-full items-center justify-center px-1 ${c.hex ? "min-w-11" : ""}`}
                >
                  {c.hex ? (
                    <span
                      className={`size-7 rounded-full border border-border ${c.name === color ? "ring-2 ring-text-primary ring-offset-2" : ""}`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ) : (
                    <span
                      className={`max-w-full truncate whitespace-nowrap rounded-sm border px-1.5 py-1 text-[11px] ${c.name === color ? "border-text-primary text-text-primary" : "border-border text-text-secondary"}`}
                    >
                      {c.name}
                    </span>
                  )}
                </button>
              )}
            </li>
          ))}
          </ul>
        </div>
      )}
      <Link href={href} className={`relative flex flex-1 flex-col gap-1.5 ${colors.length ? "pt-2" : "pt-3"}`}>
        <PendingVeil />
        <h2 className="line-clamp-2 text-[15px] font-medium leading-snug text-text-primary">{name}</h2>
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className={`text-[17px] font-bold tracking-[0.01em] ${onSale ? "text-accent" : "text-text-primary"}`}>{formatVnd(price)}</span>
          {onSale && <s className="text-[13px] text-text-muted">{formatVnd(originalPrice)}</s>}
        </p>
        {(() => {
          // Default 5 stars (owner 2026-10-17); real reviews take over when they exist.
          // Sold count comes from the Shopee shop (manual field, no Shopee API).
          const hasReal = reviewCount > 0 && ratingAverage >= 3;
          const shown = hasReal ? ratingAverage : 5;
          return (
            // Rating, express badge, sold count and gift share one row (owner 2026-10-20);
            // on a narrow card the row wraps, stars + express first.
            <p className="flex w-fit max-w-full flex-wrap items-center gap-1.5">
              {/* relative: contains the absolutely-positioned sr-only text (S13 2026-10-17:
                  without it, the sr-only sat at x=377px, widening the page to 378px). */}
              <span className="relative flex items-center gap-1 whitespace-nowrap rounded-sm border border-warning px-1.5 py-0.5 text-caption">
                <span aria-hidden className="text-warning">★</span>
                <span className="text-text-primary">{shown.toFixed(1)}</span>
                {hasReal && <span className="text-text-secondary">({reviewCount})</span>}
                <span className="sr-only">
                  {hasReal ? `điểm trung bình, ${reviewCount} đánh giá` : "đánh giá 5 sao"}
                </span>
              </span>
              <span className="flex items-center gap-1 whitespace-nowrap rounded-sm bg-accent/10 px-1.5 py-0.5 text-caption font-medium text-accent">
                <span aria-hidden>⚡</span>Hoả tốc HCM
              </span>
              {shopeeSoldCount > 0 && (
                <span className="whitespace-nowrap text-caption text-text-secondary">Đã bán {shopeeSoldCount}</span>
              )}
              {giftLabel && (
                <span className="flex items-center gap-1 whitespace-nowrap rounded-sm bg-accent/10 px-1.5 py-0.5 text-caption font-medium text-accent">
                  <span aria-hidden>🎁</span>
                  {giftLabel}
                </span>
              )}
            </p>
          );
        })()}
      </Link>
    </div>
  );
}
