import Link from "next/link";
import type { ReactNode } from "react";
import { formatVnd } from "@/lib/format";
import { ThumbImage } from "@/components/product/ThumbImage";

// reviewHref is set only by "My orders" for a delivered order's item: it deep-links to that
// product's review tab. Guest lookup never sets it, so no review button appears there.
export type OrderSummaryItem = { name: string; color: string | null; size: string | null; qty: number; price: number; imageUrl: string | null; reviewHref?: string | null };

// Items + totals of a placed order (snapshotted prices). Used by guest lookup and "My orders";
// `children` is the delivery line under the total.
export function OrderSummary({ items, subtotal, discount, shippingFee, total, children }: {
  items: OrderSummaryItem[];
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  children: ReactNode;
}) {
  return (
    <>
      <ul className="flex flex-col gap-4 rounded-sm bg-bg-secondary p-6">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3">
            <div className="relative aspect-square w-16 shrink-0 overflow-hidden rounded-sm bg-bg-tertiary">
              {item.imageUrl && <ThumbImage src={item.imageUrl} thumb={120} alt={item.name} fill sizes="64px" className="object-cover" />}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-product-name">{item.name}</span>
              <span className="text-caption uppercase text-text-secondary">
                {[item.color, item.size].filter(Boolean).join(" / ")} · SL {item.qty}
              </span>
              {item.reviewHref && (
                <Link href={item.reviewHref} className="self-start text-caption font-semibold text-text-primary underline underline-offset-4 hover:text-accent">
                  Viết đánh giá
                </Link>
              )}
            </div>
            <span className="text-product-name">{formatVnd(item.price * item.qty)}</span>
          </li>
        ))}
      </ul>

      <dl className="flex flex-col gap-3 rounded-sm border border-border p-6">
        <div className="flex justify-between"><dt className="text-text-secondary">Tạm tính</dt><dd>{formatVnd(subtotal)}</dd></div>
        {discount > 0 && (
          <div className="flex justify-between"><dt className="text-text-secondary">Giảm giá</dt><dd className="text-accent">−{formatVnd(discount)}</dd></div>
        )}
        {/* 0 only on orders placed before shipping was charged (2026-10-09). */}
        {shippingFee > 0 && (
          <div className="flex justify-between"><dt className="text-text-secondary">Phí vận chuyển</dt><dd>{formatVnd(shippingFee)}</dd></div>
        )}
        <div className="flex justify-between border-t border-border pt-3">
          <dt className="text-nav uppercase">Tổng thanh toán khi nhận hàng</dt><dd className="text-price">{formatVnd(total)}</dd>
        </div>
        {children}
      </dl>
    </>
  );
}
