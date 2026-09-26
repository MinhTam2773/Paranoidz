"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getCartItems, type CartItem } from "@/app/cart/actions";
import { TrashIcon } from "@/components/layout/icons";
import { QuantityStepper } from "@/components/product/QuantityStepper";
import { removeFromCart, setCartQty, useCart } from "@/lib/cart";
import { formatVnd } from "@/lib/format";

const primaryClass =
  "flex h-12 w-full items-center justify-center rounded-sm bg-accent text-button uppercase text-text-on-dark transition-all duration-200 hover:-translate-y-px hover:bg-accent-hover hover:shadow-accent";
const secondaryClass =
  "flex h-12 w-full items-center justify-center rounded-sm border border-text-primary text-button uppercase text-text-primary transition-colors duration-200 hover:bg-text-primary hover:text-text-on-dark";

// Cart lines come from localStorage; name/price/stock are re-read from the DB on every change of
// the id set. Totals are display only — the order route recomputes them (ARCHITECTURE.md §2.2).
export function CartView() {
  const lines = useCart();
  const [items, setItems] = useState<Map<string, CartItem> | null>(null);
  const idsKey = lines.map((l) => l.variantId).toSorted().join(",");

  useEffect(() => {
    let cancelled = false;
    (idsKey ? getCartItems(idsKey.split(",")) : Promise.resolve([])).then((res) => {
      if (!cancelled) setItems(new Map(res.map((i) => [i.variantId, i])));
    });
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  if (!items) return <p className="text-text-secondary">Loading your cart…</p>;

  if (!lines.length) {
    return (
      <div className="flex flex-col items-start gap-6">
        <p className="text-text-secondary">Your cart is empty.</p>
        <Link href="/products" className={`${secondaryClass} max-w-xs`}>
          Continue shopping
        </Link>
      </div>
    );
  }

  const rows = lines.map((line) => {
    const item = items.get(line.variantId);
    const issue = !item
      ? "This item is no longer available."
      : item.stock === 0
        ? "Sold out — remove it to check out."
        : line.qty > item.stock
          ? `Only ${item.stock} left — reduce the quantity to check out.`
          : null;
    return { line, item, issue };
  });
  const blocked = rows.some((r) => r.issue);
  const subtotal = rows.reduce((sum, { line, item }) => sum + (item ? item.price * line.qty : 0), 0);
  const count = lines.reduce((sum, l) => sum + l.qty, 0);

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
      <ul className="flex flex-col lg:col-span-8">
        {rows.map(({ line, item, issue }) => {
          const onSale = item?.originalPrice != null && item.originalPrice > item.price;
          return (
            <li key={line.variantId} className="flex gap-4 border-b border-border py-6 first:pt-0">
              <Link
                href={item ? `/products/${item.slug}` : "/products"}
                className="relative aspect-3/4 w-24 shrink-0 overflow-hidden rounded-sm bg-bg-secondary sm:w-28"
              >
                {item?.imageUrl && <Image src={item.imageUrl} alt={item.name} fill sizes="112px" className="object-cover" />}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col gap-1">
                    {item ? (
                      <Link href={`/products/${item.slug}`} className="text-product-name text-text-primary hover:underline">
                        {item.name}
                      </Link>
                    ) : (
                      <span className="text-product-name text-text-muted">Unavailable item</span>
                    )}
                    {item && (
                      <span className="text-caption uppercase text-text-secondary">
                        {item.color} / {item.size}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFromCart(line.variantId)}
                    aria-label={item ? `Remove ${item.name} (${item.color} / ${item.size})` : "Remove unavailable item"}
                    className="-mr-3 -mt-3 flex size-11 shrink-0 items-center justify-center text-text-muted transition-colors duration-200 hover:text-accent"
                  >
                    <TrashIcon width={20} height={20} />
                  </button>
                </div>
                {issue && <p className="text-caption text-accent">{issue}</p>}
                {item && (
                  <div className="mt-auto flex flex-wrap items-end justify-between gap-3">
                    <QuantityStepper
                      value={line.qty}
                      max={Math.max(item.stock, 1)}
                      onChange={(qty) => setCartQty(line.variantId, qty)}
                      label={`Quantity of ${item.name}`}
                    />
                    <p className="flex flex-col items-end gap-1">
                      <span className={`text-price ${onSale ? "text-accent" : "text-text-primary"}`}>
                        {formatVnd(item.price * line.qty)}
                      </span>
                      {onSale && <s className="text-price-old text-text-muted">{formatVnd(item.originalPrice! * line.qty)}</s>}
                    </p>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <aside className="lg:col-span-4">
        <div className="flex flex-col gap-6 rounded-sm border border-border p-6 lg:sticky lg:top-36">
          <h2 className="text-h3 uppercase">Order summary</h2>
          <div className="flex items-baseline justify-between">
            <span className="text-nav uppercase text-text-secondary">Subtotal ({count})</span>
            <span className="text-price">{formatVnd(subtotal)}</span>
          </div>
          <p className="text-caption text-text-muted">Shipping and vouchers are calculated at checkout.</p>
          <div className="flex flex-col gap-3">
            {blocked ? (
              <>
                <button
                  type="button"
                  disabled
                  className="h-12 w-full cursor-not-allowed rounded-sm bg-bg-tertiary text-button uppercase text-text-muted"
                >
                  Checkout
                </button>
                <p className="text-caption text-accent">Fix the items marked above to check out.</p>
              </>
            ) : (
              <Link href="/checkout" className={primaryClass}>
                Checkout
              </Link>
            )}
            <Link href="/products" className={secondaryClass}>
              Continue shopping
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}
