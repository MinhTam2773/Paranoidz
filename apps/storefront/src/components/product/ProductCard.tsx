import Image from "next/image";
import Link from "next/link";
import { BagPlusIcon } from "@/components/layout/icons";
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
  reviewCount: number;
  ratingAverage: number;
};

// DESIGN.md §4 product card (client reference 2026-10-12): borderless, rounded 3:4 image on
// bg-secondary with hover zoom, sale / sold-out badge top-right, heart + cart buttons bottom-right,
// name, dual price, rating. Sold out (every variant at 0, ARCHITECTURE.md §3) replaces the sale
// badge and drops the cart button. The rating shows from an average of 3 up (owner, 2026-10-12).
// `eager`: above-the-fold cards, so the LCP image isn't lazy-loaded. The buttons sit beside the
// link in an overlay the size of the image, not inside it (a button inside <a> is invalid HTML).
export function ProductCard({ product, eager = false }: { product: ProductCardData; eager?: boolean }) {
  const { id, name, slug, imageUrl, price, originalPrice, soldOut, reviewCount, ratingAverage } = product;
  const onSale = originalPrice !== null && originalPrice > price;
  const href = `/products/${slug}`;

  return (
    <div className="group relative flex flex-col">
      <Link href={href} className="flex flex-1 flex-col">
        <div className="relative aspect-3/4 overflow-hidden rounded-lg bg-bg-secondary">
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
            <span className="absolute right-2 top-2 rounded-sm border border-border bg-bg-primary px-2 py-1 text-caption font-semibold uppercase text-text-primary">
              Hết hàng
            </span>
          ) : (
            onSale && (
              <span className="absolute right-2 top-2 rounded-sm bg-accent px-2 py-1 text-caption font-semibold text-text-on-dark">
                -{Math.round(((originalPrice - price) / originalPrice) * 100)}%
              </span>
            )
          )}
        </div>
        <div className="flex flex-col gap-2 pt-3">
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
        </div>
      </Link>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex aspect-3/4 items-end justify-end gap-2 p-2">
        <WishlistButton productId={id} className="pointer-events-auto rounded-full bg-bg-primary shadow-1" />
        {!soldOut && (
          // Step 3 of the card rework turns this into a size / colour picker; until then it opens the product.
          <Link
            href={href}
            aria-label={`Chọn size và thêm vào giỏ: ${name}`}
            className="pointer-events-auto flex size-11 items-center justify-center rounded-full bg-bg-primary text-text-primary shadow-1 transition-transform duration-200 hover:scale-110"
          >
            <BagPlusIcon width={22} height={22} />
          </Link>
        )}
      </div>
    </div>
  );
}
