import Image from "next/image";
import Link from "next/link";
import { formatVnd } from "@/lib/format";
import { WishlistButton } from "./WishlistButton";

export type ProductCardData = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  price: number;
  originalPrice: number | null;
  soldOut: boolean;
};

// DESIGN.md §4 product card: 3:4 image on bg-secondary with hover zoom, sale badge + dual price.
// Sold out (every variant at 0, ARCHITECTURE.md §3) replaces the sale badge.
// `eager`: above-the-fold cards, so the LCP image isn't lazy-loaded. The heart sits beside the link,
// not inside it (a button inside <a> is invalid HTML).
export function ProductCard({ product, eager = false }: { product: ProductCardData; eager?: boolean }) {
  const { id, name, slug, imageUrl, price, originalPrice, soldOut } = product;
  const onSale = originalPrice !== null && originalPrice > price;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-sm border border-border bg-bg-primary transition-shadow duration-200 hover:shadow-1">
      <Link href={`/products/${slug}`} className="flex flex-1 flex-col">
        <div className="relative aspect-3/4 overflow-hidden bg-bg-secondary">
          {imageUrl && (
            <Image
              src={imageUrl}
              alt={name}
              fill
              loading={eager ? "eager" : undefined}
              sizes="(min-width: 1280px) 411px, (min-width: 1024px) 33vw, 50vw"
              className="object-cover transition-transform duration-200 group-hover:scale-105"
            />
          )}
          {soldOut ? (
            <span className="absolute left-2 top-2 rounded-sm border border-border bg-bg-primary px-2 py-1 text-caption font-semibold uppercase text-text-primary">
              Sold out
            </span>
          ) : (
            onSale && (
              <span className="absolute left-2 top-2 rounded-sm bg-accent px-2 py-1 text-caption font-semibold text-text-on-dark">
                -{Math.round(((originalPrice - price) / originalPrice) * 100)}%
              </span>
            )
          )}
        </div>
        <div className="flex flex-col gap-2 p-4">
          <h2 className="line-clamp-2 text-product-name text-text-primary">{name}</h2>
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className={`text-price ${onSale ? "text-accent" : "text-text-primary"}`}>{formatVnd(price)}</span>
            {onSale && <s className="text-price-old text-text-muted">{formatVnd(originalPrice)}</s>}
          </p>
        </div>
      </Link>
      <WishlistButton productId={id} className="absolute right-2 top-2 bg-bg-primary/80" />
    </div>
  );
}
