"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { ProductCard, type ProductCardData } from "@/components/product/ProductCard";
import { ProductRow } from "@/components/home/ProductRow";
import type { FlashSaleState } from "@/lib/flash-sale";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// Current time in whole seconds; null while server-rendering and hydrating. The page is ISR
// (up to a minute old), so a server-rendered clock never matched the browser's and threw
// React #418 on every homepage load (PageSpeed 2026-10-30). The boxes show "--" until hydrated.
const subscribeSeconds = (onTick: () => void) => {
  const t = setInterval(onTick, 1000);
  return () => clearInterval(t);
};
const nowSeconds = () => Math.floor(Date.now() / 1000);

function useCountdown(targetMs: number) {
  const now = useSyncExternalStore(subscribeSeconds, nowSeconds, () => null);
  if (now === null) return { h: "--", m: "--", s: "--" };
  const s = Math.max(0, Math.floor(targetMs / 1000) - now);
  return { h: pad(Math.floor(s / 3600)), m: pad(Math.floor((s % 3600) / 60)), s: pad(s % 60) };
}

function CountdownBoxes({ targetMs }: { targetMs: number }) {
  const { h, m, s } = useCountdown(targetMs);
  return (
    <span className="flex items-center gap-1" aria-label={`Còn ${h} giờ ${m} phút ${s} giây`}>
      {[h, m, s].map((v, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className="min-w-9 rounded-sm bg-bg-dark px-2 py-1 text-center text-h3 font-bold tabular-nums text-text-on-dark">
            {v}
          </span>
          {i < 2 && <span className="text-h3 font-bold text-text-primary">:</span>}
        </span>
      ))}
    </span>
  );
}

// Flash sale section (2026-10-16): replaces the old "Đang khuyến mãi" row.
// Server computes the state + flash prices; this only renders + counts down.
export function FlashSale({ state, cards }: { state: FlashSaleState; cards: ProductCardData[] }) {
  if (!cards.length) return null;
  return (
    <section aria-label="Flash sale">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <h2 className="flex items-center gap-3 text-h2 uppercase">
          <span aria-hidden className="text-accent">⚡</span>
          Flash sale
          <span className="rounded-sm bg-warning px-2 py-0.5 text-caption font-bold uppercase text-text-primary">
            Sắp cháy hàng
          </span>
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-nav uppercase text-text-secondary">
            {state.active ? "Kết thúc trong" : `Bắt đầu lúc ${pad(state.nextHour)}:00`}
          </span>
          <CountdownBoxes targetMs={state.active ? state.endsAt : state.nextStartsAt} />
        </div>
      </div>
      <ProductRow label="Sản phẩm flash sale">
        {cards.map((card) => (
          <ProductCard key={card.slug} product={card} />
        ))}
      </ProductRow>
      <p className="mt-4 text-center">
        <Link href="/products" className="text-nav uppercase text-text-secondary hover:text-text-primary">
          Xem tất cả →
        </Link>
      </p>
    </section>
  );
}
