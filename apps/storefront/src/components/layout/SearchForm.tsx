"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { searchSuggestions } from "@/app/search/actions";
import type { ProductCardData } from "@/components/product/ProductCard";
import { formatVnd } from "@/lib/format";
import { SearchIcon } from "./icons";

const MIN_CHARS = 2;
const DEBOUNCE_MS = 250;

// GET form to /search: works without JS. With JS it's a WAI-ARIA combobox: once typing pauses,
// up to 5 ranked products show below (answers to older keystrokes are dropped; the previous list
// stays, dimmed, while the next one loads). ↑/↓ + Enter open a product; Enter with nothing
// highlighted submits the full search. 16px text below lg so iOS Safari doesn't zoom on focus.
// `onNavigate`: a suggestion was picked (the mobile header closes its search panel).
export function SearchForm({
  autoFocus,
  defaultValue = "",
  onNavigate,
}: {
  autoFocus?: boolean;
  defaultValue?: string;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<{ query: string; products: ProductCardData[] } | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const formRef = useRef<HTMLFormElement>(null);
  const request = useRef(0);
  const listId = useId();
  const query = value.trim();

  useEffect(() => {
    const id = ++request.current; // any answer still in flight is now stale
    if (query.length < MIN_CHARS) return;
    const timer = setTimeout(async () => {
      try {
        const products = await searchSuggestions(query);
        if (id !== request.current) return;
        setSuggestions({ query, products });
        setActive(-1);
      } catch {
        // Suggestions are optional; the form still submits to /search.
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!formRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const shown = open && query.length >= MIN_CHARS && suggestions !== null;
  const searchHref = `/search?q=${encodeURIComponent(query)}`;
  const hrefs = suggestions?.products.length ? [...suggestions.products.map((p) => `/products/${p.slug}`), searchHref] : [];

  function picked() {
    setOpen(false);
    onNavigate?.();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape" && shown) {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "Tab") {
      setOpen(false);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!hrefs.length) return;
      e.preventDefault();
      setOpen(true);
      // -1 = back in the input, no option highlighted.
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => ((a + 1 + step + hrefs.length + 1) % (hrefs.length + 1)) - 1);
    } else if (e.key === "Enter" && shown && active >= 0 && hrefs[active]) {
      e.preventDefault();
      picked();
      router.push(hrefs[active]);
    }
  }

  const optionClass = (i: number) => (i === active ? "bg-bg-tertiary" : "");

  return (
    <form ref={formRef} action="/search" role="search" className="relative w-full">
      <SearchIcon
        width={18}
        height={18}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
      />
      <input
        type="search"
        name="q"
        role="combobox"
        autoFocus={autoFocus}
        autoComplete="off"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search product..."
        aria-label="Search products"
        aria-expanded={shown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={shown && active >= 0 ? `${listId}-${active}` : undefined}
        className="h-11 w-full rounded-sm border border-border bg-bg-secondary pl-10 pr-4 text-base text-text-primary lg:text-product-name placeholder:text-text-muted focus:border-text-primary focus:shadow-[0_0_0_2px_var(--color-accent-soft)] focus:outline-none"
      />

      {shown && (
        <div
          id={listId}
          role="listbox"
          aria-label="Product suggestions"
          aria-busy={suggestions.query !== query}
          className={`absolute inset-x-0 top-full z-20 mt-1 flex flex-col overflow-hidden rounded-sm border border-border bg-bg-primary shadow-2 transition-opacity duration-200 ${
            suggestions.query !== query ? "opacity-60" : ""
          }`}
        >
          {suggestions.products.map((p, i) => {
            const onSale = p.originalPrice !== null && p.originalPrice > p.price;
            return (
              <Link
                key={p.slug}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                tabIndex={-1}
                href={`/products/${p.slug}`}
                onClick={picked}
                onPointerMove={() => setActive(i)}
                className={`flex items-center gap-3 px-3 py-2 ${optionClass(i)}`}
              >
                <span className="relative aspect-3/4 w-9 shrink-0 overflow-hidden rounded-sm bg-bg-secondary">
                  {p.imageUrl && <Image src={p.imageUrl} alt="" fill sizes="36px" className="object-cover" />}
                </span>
                <span className="min-w-0 flex-1 truncate text-product-name text-text-primary">{p.name}</span>
                {p.soldOut ? (
                  <span className="shrink-0 text-caption uppercase text-text-muted">Sold out</span>
                ) : (
                  <span className={`shrink-0 text-product-name font-semibold ${onSale ? "text-accent" : "text-text-primary"}`}>
                    {formatVnd(p.price)}
                  </span>
                )}
              </Link>
            );
          })}
          {suggestions.products.length ? (
            <Link
              id={`${listId}-${suggestions.products.length}`}
              role="option"
              aria-selected={active === suggestions.products.length}
              tabIndex={-1}
              href={searchHref}
              onClick={picked}
              onPointerMove={() => setActive(suggestions.products.length)}
              className={`flex h-11 items-center border-t border-border px-3 text-nav uppercase text-text-primary ${optionClass(suggestions.products.length)}`}
            >
              View all results
            </Link>
          ) : (
            <p className="px-3 py-3 text-product-name wrap-break-word text-text-muted">
              No products match &ldquo;{suggestions.query}&rdquo;.
            </p>
          )}
        </div>
      )}
    </form>
  );
}
