"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getCartItems, type CartItem } from "@/app/cart/actions";
import { TrashIcon } from "@/components/layout/icons";
import { QuantityStepper } from "@/components/product/QuantityStepper";
import { BundleEstimate, useBundleEstimate } from "./BundleEstimate";
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
  const bundleEstimate = useBundleEstimate(lines);
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

  if (!items) return <p className="text-text-secondary">Đang tải giỏ hàng…</p>;

  if (!lines.length) {
    return (
      <div className="flex flex-col items-start gap-6">
        <p className="text-text-secondary">Giỏ hàng của bạn đang trống.</p>
        <Link href="/products" className={`${secondaryClass} max-w-xs`}>
          Tiếp tục mua sắm
        </Link>
      </div>
    );
  }

  const rows = lines.map((line) => {
    const item = items.get(line.variantId);
    const issue = !item
      ? "Sản phẩm này không còn bán."
      : item.stock === 0
        ? "Hết hàng — hãy xóa khỏi giỏ để đặt hàng."
        : line.qty > item.stock
          ? `Chỉ còn ${item.stock} sản phẩm — hãy giảm số lượng để đặt hàng.`
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
                      <span className="text-product-name text-text-muted">Sản phẩm không còn bán</span>
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
                    aria-label={item ? `Xóa ${item.name} (${item.color} / ${item.size})` : "Xóa sản phẩm không còn bán"}
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
                      label={`Số lượng ${item.name}`}
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
          <h2 className="text-h3 uppercase">Tóm tắt đơn hàng</h2>
          <div className="flex items-baseline justify-between">
            <span className="text-nav uppercase text-text-secondary">Tạm tính ({count})</span>
            <span className="text-price">{formatVnd(subtotal)}</span>
          </div>
          <BundleEstimate estimate={bundleEstimate} subtotal={subtotal} />
          <p className="text-caption text-text-muted">Phí vận chuyển và mã giảm giá được tính khi đặt hàng.</p>
          <div className="flex flex-col gap-3">
            {blocked ? (
              <>
                <button
                  type="button"
                  disabled
                  className="h-12 w-full cursor-not-allowed rounded-sm bg-bg-tertiary text-button uppercase text-text-muted"
                >
                  Thanh toán
                </button>
                <p className="text-caption text-accent">Hãy xử lý các sản phẩm được đánh dấu ở trên để đặt hàng.</p>
              </>
            ) : (
              <Link href="/checkout" className={primaryClass}>
                Thanh toán
              </Link>
            )}
            <Link href="/products" className={secondaryClass}>
              Tiếp tục mua sắm
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}
