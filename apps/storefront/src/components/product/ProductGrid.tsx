"use client";

import { useRef, useState, type ReactNode } from "react";
import { ChevronDownIcon } from "@/components/layout/icons";
import { ProductCard, type ProductCardData } from "./ProductCard";

const PER_PAGE = 12;

const discount = (p: ProductCardData) =>
  p.originalPrice !== null && p.originalPrice > p.price ? (p.originalPrice - p.price) / p.originalPrice : -1;

const SORTS = {
  recent: { label: "Mới nhất", compare: null },
  "price-asc": { label: "Giá thấp → cao", compare: (a: ProductCardData, b: ProductCardData) => a.price - b.price },
  "price-desc": { label: "Giá cao → thấp", compare: (a: ProductCardData, b: ProductCardData) => b.price - a.price },
  discount: { label: "Giảm nhiều nhất", compare: (a: ProductCardData, b: ProductCardData) => discount(b) - discount(a) },
};
type Sort = keyof typeof SORTS;

// 1 … 4 5 6 … 10: first, last and the current page's neighbours.
function pageList(current: number, total: number) {
  const keep = new Set([1, total, current - 1, current, current + 1]);
  const out: (number | "gap")[] = [];
  let prev = 0;
  for (let p = 1; p <= total; p++) {
    if (!keep.has(p)) continue;
    if (p - prev > 1) out.push("gap");
    out.push(p);
    prev = p;
  }
  return out;
}

const pageButton = "flex size-11 items-center justify-center rounded-sm border text-button transition-colors duration-200";

// Stitch "Outlet 2026" toolbar + grid (spec 2026-10-11 §4, approach A): the page passes every card
// (ISR), sorting and paging happen here. "Mới nhất" keeps the order the server sent. `children` is the
// page heading, laid out beside the sort select.
export function ProductGrid({ cards, children }: { cards: ProductCardData[]; children: ReactNode }) {
  const [sort, setSort] = useState<Sort>("recent");
  const [page, setPage] = useState(1);
  const top = useRef<HTMLDivElement>(null);

  const compare = SORTS[sort].compare;
  const sorted = compare ? cards.toSorted(compare) : cards;
  const pages = Math.ceil(sorted.length / PER_PAGE);
  const visible = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function goTo(p: number) {
    setPage(p);
    // Instant: the re-render that follows (a shorter last page) cancels a smooth scroll in Chromium.
    top.current?.scrollIntoView({ block: "start" });
  }

  return (
    <div ref={top} className="scroll-mt-20 lg:scroll-mt-32">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>{children}</div>
        {cards.length > 1 && (
          <label className="flex shrink-0 items-center gap-3 text-nav uppercase text-text-secondary">
            Sắp xếp
            <span className="relative">
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as Sort);
                  setPage(1);
                }}
                className="h-11 appearance-none rounded-sm border border-border bg-bg-primary pl-3 pr-10 text-base normal-case text-text-primary focus:border-text-primary focus:shadow-[0_0_0_2px_var(--color-accent-soft)] focus:outline-none lg:text-product-name"
              >
                {Object.entries(SORTS).map(([value, s]) => (
                  <option key={value} value={value}>{s.label}</option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-primary" />
            </span>
          </label>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {visible.map((card, i) => (
          <ProductCard key={card.slug} product={card} eager={page === 1 && i < 3} />
        ))}
      </div>

      {pages > 1 && (
        <nav aria-label="Phân trang" className="mt-10 flex justify-center gap-2">
          <button type="button" aria-label="Trang trước" disabled={page === 1} onClick={() => goTo(page - 1)} className={`${pageButton} border-border disabled:opacity-30`}>
            <ChevronDownIcon className="size-4 rotate-90" />
          </button>
          {pageList(page, pages).map((p, i) =>
            p === "gap" ? (
              <span key={`gap-${i}`} aria-hidden className="flex size-11 items-center justify-center text-text-muted">…</span>
            ) : (
              <button
                key={p}
                type="button"
                aria-current={p === page ? "page" : undefined}
                onClick={() => goTo(p)}
                className={`${pageButton} ${p === page ? "border-text-primary bg-text-primary text-text-on-dark" : "border-border hover:border-text-primary"}`}
              >
                {p}
              </button>
            ),
          )}
          <button type="button" aria-label="Trang sau" disabled={page === pages} onClick={() => goTo(page + 1)} className={`${pageButton} border-border disabled:opacity-30`}>
            <ChevronDownIcon className="size-4 -rotate-90" />
          </button>
        </nav>
      )}
    </div>
  );
}
