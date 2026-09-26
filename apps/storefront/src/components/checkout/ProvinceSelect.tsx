"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { SearchIcon } from "@/components/layout/icons";
import { PROVINCES, searchKey } from "@/lib/provinces";

const INDEX = PROVINCES.map((p) => ({
  ...p,
  keys: [p.name, ...(p.formerly ?? []), ...(p.aliases ?? [])].map(searchKey),
}));

// Searchable select for the 34 provinces (WAI-ARIA combobox inside a popover). The trigger keeps
// showing "Choose…" (or the pick) — it's a value slot, not a placeholder. Search ignores accents
// and matches pre-2025 province names. `name` goes on a hidden input so FormData sees the value.
export function ProvinceSelect({
  id,
  name,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  describedBy?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  const q = searchKey(query);
  const matches = q ? INDEX.filter((p) => p.keys.some((k) => k.includes(q))) : INDEX;

  function show() {
    setQuery("");
    setActive(Math.max(0, INDEX.findIndex((p) => p.name === value)));
    setOpen(true);
  }

  function close(focusTrigger: boolean) {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  }

  function pick(name: string) {
    onChange(name);
    close(true);
  }

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  });

  useEffect(() => {
    if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, listId]);

  function onSearchKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (matches.length ? (a + step + matches.length) % matches.length : 0));
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      setActive(e.key === "Home" ? 0 : Math.max(matches.length - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault(); // never submit the checkout form from here
      if (matches[active]) pick(matches[active].name);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "Tab") {
      close(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name={name} value={value} />
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-describedby={describedBy}
        onClick={() => (open ? close(false) : show())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            show();
          }
        }}
        className={`flex h-11 w-full items-center justify-between rounded-sm border bg-bg-primary px-3 text-left text-base transition-colors duration-200 focus:border-text-primary focus:shadow-[0_0_0_2px_var(--color-accent-soft)] focus:outline-none lg:text-product-name ${
          invalid ? "border-accent" : "border-border"
        } ${value ? "text-text-primary" : "text-text-muted"}`}
      >
        <span>{value || "Choose…"}</span>
        <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true" className={`text-text-secondary transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 flex flex-col rounded-sm border border-border bg-bg-primary shadow-2">
          <div className="relative border-b border-border p-2">
            <SearchIcon width={16} height={16} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              autoFocus
              role="combobox"
              aria-label="Search city or province"
              aria-expanded
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={matches[active] ? `${listId}-${active}` : undefined}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onSearchKey}
              placeholder="Search, e.g. Hồ Chí Minh"
              className="h-10 w-full rounded-sm border border-border bg-bg-secondary pl-9 pr-3 text-base text-text-primary placeholder:text-text-muted focus:border-text-primary focus:outline-none lg:text-product-name"
            />
          </div>
          <ul id={listId} role="listbox" aria-label="Cities and provinces" className="max-h-64 overflow-y-auto py-1">
            {matches.map((p, i) => {
              // Matched via a merged pre-2025 province: say so (aliases like "Sài Gòn" need no hint).
              const via = q && !p.keys[0].includes(q) ? p.formerly?.find((n) => searchKey(n).includes(q)) : null;
              return (
                <li
                  key={p.name}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={p.name === value}
                  onPointerMove={() => setActive(i)}
                  onClick={() => pick(p.name)}
                  className={`flex cursor-pointer items-baseline justify-between gap-3 px-3 py-3 text-product-name ${
                    i === active ? "bg-bg-tertiary" : ""
                  } ${p.name === value ? "font-semibold" : ""}`}
                >
                  <span>{p.name}</span>
                  {via && <span className="text-caption text-text-muted">incl. {via}</span>}
                </li>
              );
            })}
            {!matches.length && <li className="px-3 py-3 text-product-name text-text-muted">No city or province matches “{query}”.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
