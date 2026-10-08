"use client";

import { useEffect, useState } from "react";
import { getBundleEstimate, type BundleEstimate as Estimate } from "@/app/cart/actions";
import type { CartLine } from "@/lib/cart";
import { formatVnd } from "@/lib/format";

// Re-asked whenever a line or a quantity changes (sets depend on quantities, unlike prices).
export function useBundleEstimate(lines: CartLine[]) {
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const key = lines.map((l) => `${l.variantId}:${l.qty}`).toSorted().join(",");

  useEffect(() => {
    let cancelled = false;
    const current = key ? key.split(",").map((s) => ({ variantId: s.split(":")[0], qty: Number(s.split(":")[1]) })) : [];
    (current.length ? getBundleEstimate(current) : Promise.resolve(null)).then((res) => {
      if (!cancelled) setEstimate(res);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return estimate;
}

// "Combo: <name> ×2 … −₫X" + the no-stacking note, for the cart and checkout summaries.
export function BundleEstimate({ estimate, subtotal }: { estimate: Estimate | null; subtotal: number }) {
  if (!estimate) return null;
  const names = estimate.bundles.map((b) => (b.sets > 1 ? `${b.name} ×${b.sets}` : b.name)).join(", ");
  return (
    <div className="flex flex-col gap-2">
      <dl className="flex justify-between gap-4">
        <dt className="min-w-0 wrap-break-word text-text-secondary">Combo: {names}</dt>
        <dd className="shrink-0 text-accent">−{formatVnd(Math.min(estimate.amount, subtotal))}</dd>
      </dl>
      <p className="text-caption text-text-muted">
        Ưu đãi combo không cộng dồn với mã giảm giá hay ưu đãi 5 đơn đầu — khi đặt hàng, bạn được mức giảm cao hơn.
      </p>
    </div>
  );
}
