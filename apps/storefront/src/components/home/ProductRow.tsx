"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// DESIGN.md §4 promotion / category rows: a horizontal scroll-snap row of cards (2 visible on
// mobile, 3 on tablet, 4 on desktop) with one dot per screenful, shown only when the row overflows.
// The ResizeObserver's first callback does the initial measure (no setState in the effect body).
export function ProductRow({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(0);

  // One screenful = the visible width plus the gap before the next card.
  function stride(el: HTMLDivElement) {
    return el.clientWidth + parseFloat(getComputedStyle(el).columnGap);
  }

  useEffect(() => {
    const el = ref.current!;
    function measure() {
      const s = stride(el);
      const total = Math.ceil((el.scrollWidth + s - el.clientWidth) / s - 0.01);
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
      setPages(total);
      setPage(atEnd ? total - 1 : Math.round(el.scrollLeft / s));
    }
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, []);

  return (
    <div>
      <div
        ref={ref}
        aria-label={label}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto [scrollbar-width:none] sm:gap-4 *:shrink-0 *:snap-start *:basis-[calc((100%-12px)/2)] sm:*:basis-[calc((100%-32px)/3)] lg:*:basis-[calc((100%-48px)/4)]"
      >
        {children}
      </div>
      {pages > 1 && (
        <div className="mt-2 flex justify-center">
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${label}: trang ${i + 1}`}
              aria-current={i === page}
              onClick={() => ref.current!.scrollTo({ left: i * stride(ref.current!), behavior: "smooth" })}
              className="flex h-11 w-6 items-center justify-center"
            >
              <span className={`size-2 rounded-full transition-colors duration-200 ${i === page ? "bg-text-primary" : "bg-border-hover"}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
