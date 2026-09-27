import Image from "next/image";
import type { ReactNode } from "react";
import { formatVnd } from "@/lib/format";

export type OrderSummaryItem = { name: string; color: string | null; size: string | null; qty: number; price: number; imageUrl: string | null };

// Items + totals of a placed order (snapshotted prices). Used by guest lookup and "My orders";
// `children` is the delivery line under the total.
export function OrderSummary({ items, subtotal, discount, total, children }: {
  items: OrderSummaryItem[];
  subtotal: number;
  discount: number;
  total: number;
  children: ReactNode;
}) {
  return (
    <>
      <ul className="flex flex-col gap-4 rounded-sm bg-bg-secondary p-6">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3">
            <div className="relative aspect-3/4 w-16 shrink-0 overflow-hidden rounded-sm bg-bg-tertiary">
              {item.imageUrl && <Image src={item.imageUrl} alt={item.name} fill sizes="64px" className="object-cover" />}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-product-name">{item.name}</span>
              <span className="text-caption uppercase text-text-secondary">
                {[item.color, item.size].filter(Boolean).join(" / ")} · Qty {item.qty}
              </span>
            </div>
            <span className="text-product-name">{formatVnd(item.price * item.qty)}</span>
          </li>
        ))}
      </ul>

      <dl className="flex flex-col gap-3 rounded-sm border border-border p-6">
        <div className="flex justify-between"><dt className="text-text-secondary">Subtotal</dt><dd>{formatVnd(subtotal)}</dd></div>
        {discount > 0 && (
          <div className="flex justify-between"><dt className="text-text-secondary">Discount</dt><dd className="text-accent">−{formatVnd(discount)}</dd></div>
        )}
        <div className="flex justify-between border-t border-border pt-3">
          <dt className="text-nav uppercase">Total, cash on delivery</dt><dd className="text-price">{formatVnd(total)}</dd>
        </div>
        {children}
      </dl>
    </>
  );
}
