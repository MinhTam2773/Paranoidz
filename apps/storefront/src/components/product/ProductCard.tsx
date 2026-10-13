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
// colour dots, name, dual price, rating. Sold out (every variant at 0, ARCHITECTURE.md §3) replaces
// the sale badge and drops the cart button. The rating shows from an average of 3 up (owner,
// 2026-10-12). A dot swaps the photo to that colour's first one; a colour without an admin-picked
// hex shows its name instead. `eager`: above-the-fold cards, so the LCP image isn't lazy-loaded.
// The buttons and dots sit beside the links, not inside them (a button inside <a> is invalid HTML);
// the image link is a mouse/touch shortcut only, the text link is the one in the tab order.
export function ProductCard({ product, eager = false }: { product: ProductCardData; eager?: boolean }) {
  const { id, name, slug, imageUrl, imageColor, price, originalPrice, soldOut, colors, reviewCount, ratingAverage } = product;
  const [color, setColor] = useState(() => (colors.some((c) => c.name === imageColor) ? imageColor : null));
  const onSale = originalPrice !== null && originalPrice > price;
  const href = `/products/${slug}`;
  const shownImage = colors.find((c) => c.name === color)?.imageUrl ?? imageUrl;

  return (
    <div className="group flex flex-col">
      <div className="relative aspect-3/4 overflow-hidden rounded-lg bg-bg-secondary">
        <Link href={href} tabIndex={-1} aria-hidden className="absolute inset-0">
          {shownImage && (
            <Image
              src={shownImage}
              alt=""
              fill
              loading={eager ? "eager" : undefined}
              sizes="(min-width: 1280px) 411px, (min-width: 1024px) 33vw, 50vw"
              className="object-cover transition-transform duration-200 group-hover:scale-105"
            />
          )}
        </Link>
        {soldOut ? (
          <span className="pointer-events-none absolute right-2 top-2 rounded-sm border border-border bg-bg-primary px-2 py-1 text-caption font-semibold uppercase text-text-primary">
            Hết hàng
          </span>
        ) : (
          onSale && (
            <span className="pointer-events-none absolute right-2 top-2 rounded-sm bg-accent px-2 py-1 text-caption font-semibold text-text-on-dark">
              -{Math.round(((originalPrice - price) / originalPrice) * 100)}%
            </span>
          )
        )}
        <div className="absolute bottom-2 right-2 flex gap-2">
          <WishlistButton productId={id} className="rounded-full bg-bg-primary shadow-1" />
          {!soldOut && <QuickAdd product={product} color={color} onColor={setColor} />}
        </div>
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
      <Link href={href} className={`flex flex-1 flex-col gap-2 ${colors.length ? "pt-1" : "pt-3"}`}>
        <h2 className="line-clamp-2 text-product-name text-text-primary">{name}</h2>
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className={`text-price ${onSale ? "text-accent" : "text-text-primary"}`}>{formatVnd(price)}</span>
          {onSale && <s className="text-price-old text-text-muted">{formatVnd(originalPrice)}</s>}
        </p>
        {reviewCount > 0 && ratingAverage >= 3 && (
          <p className="flex w-fit items-center gap-1 rounded-sm border border-warning px-1.5 py-0.5 text-caption text-text-secondary">
            <span aria-hidden className="text-warning">★</span>
            <span className="text-text-primary">{ratingAverage.toFixed(1).replace(".", ",")}</span>
            <span>({reviewCount})</span>
            <span className="sr-only">điểm trung bình, {reviewCount} đánh giá</span>
          </p>
        )}
      </Link>
    </div>
  );
}
