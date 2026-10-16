"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { SearchIcon } from "@/components/layout/icons";
import { searchKey } from "@paranoidz/db/provinces";

export type SearchOption = { value: string; keys: string[] };

// Searchable select (WAI-ARIA combobox inside a popover) for provinces and wards. The trigger
// keeps showing "Chọn…" (or the pick) — it's a value slot, not a placeholder. Search ignores
// accents; each option matches any of its `keys` (already searchKey'd). `hint` adds a note to an
// option for the current query. `name` goes on a hidden input so FormData sees the value.
export function SearchSelect({
  id,
  name,
  value,
  onChange,
  options,
  invalid,
  describedBy,
  label,
  searchPlaceholder,
  noMatch,
  disabled,
  emptyText = "Chọn…",
  hint,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchOption[];
  invalid: boolean;
  describedBy?: string;
  label: string;
  searchPlaceholder: string;
  noMatch: (query: string) => string;
  disabled?: boolean;
  emptyText?: string;
  hint?: (option: SearchOption, query: string) => string | null | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  const q = searchKey(query);
  const matches = q ? options.filter((o) => o.keys.some((k) => k.includes(q))) : options;

  function show() {
    setQuery("");
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }

  function close(focusTrigger: boolean) {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  }

  function pick(next: string) {
    onChange(next);
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
      if (matches[active]) pick(matches[active].value);
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
        disabled={disabled}
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
        className={`flex h-11 w-full items-center justify-between gap-2 rounded-sm border bg-bg-primary px-3 text-left text-base transition-colors duration-200 focus:border-text-primary focus:shadow-[0_0_0_2px_var(--color-accent-soft)] focus:outline-none disabled:cursor-not-allowed disabled:bg-bg-secondary lg:text-product-name ${
          invalid ? "border-accent" : "border-border"
        } ${value ? "text-text-primary" : "text-text-muted"}`}
      >
        <span className="truncate">{value || emptyText}</span>
        <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true" className={`shrink-0 text-text-secondary transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
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
              aria-label={`Tìm ${label.toLowerCase()}`}
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
              placeholder={searchPlaceholder}
              className="h-10 w-full rounded-sm border border-border bg-bg-secondary pl-9 pr-3 text-base text-text-primary placeholder:text-text-muted focus:border-text-primary focus:outline-none lg:text-product-name"
            />
          </div>
          <ul id={listId} role="listbox" aria-label={label} className="max-h-64 overflow-y-auto py-1">
            {matches.map((o, i) => {
              const note = q ? hint?.(o, q) : null;
              return (
                <li
                  key={o.value}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={o.value === value}
                  onPointerMove={() => setActive(i)}
                  onClick={() => pick(o.value)}
                  className={`flex cursor-pointer items-baseline justify-between gap-3 px-3 py-3 text-product-name ${
                    i === active ? "bg-bg-tertiary" : ""
                  } ${o.value === value ? "font-semibold" : ""}`}
                >
                  <span>{o.value}</span>
                  {note && <span className="text-caption text-text-muted">{note}</span>}
                </li>
              );
            })}
            {!matches.length && <li className="px-3 py-3 text-product-name text-text-muted">{noMatch(query)}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
