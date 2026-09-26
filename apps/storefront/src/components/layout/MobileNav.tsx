"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV_LINKS, SOCIAL_LINKS } from "@/lib/site";
import { CloseIcon, MenuIcon, SearchIcon, SOCIAL_ICONS } from "./icons";
import { isActive } from "./NavLinks";
import { SearchForm } from "./SearchForm";

// Mobile Row 1 controls (DESIGN.md §4 mobile, §9): search expands on tap,
// hamburger opens a full-screen white overlay sliding in from the right.
export function MobileNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setSearchOpen((o) => !o)}
        aria-label="Search"
        aria-expanded={searchOpen}
        className="order-first flex size-11 items-center justify-center lg:hidden"
      >
        <SearchIcon />
      </button>
      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        aria-label="Open menu"
        aria-expanded={menuOpen}
        className="order-last flex size-11 items-center justify-center lg:hidden"
      >
        <MenuIcon />
      </button>

      {searchOpen && (
        <div className="absolute inset-x-0 top-full border-b border-border bg-bg-primary px-4 py-3 lg:hidden">
          <SearchForm autoFocus />
        </div>
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        inert={!menuOpen}
        className={`fixed inset-0 z-50 flex flex-col bg-bg-primary transition-transform duration-300 lg:hidden ${
          // Shadow only while open: off-screen, its blur would bleed onto the right edge.
          menuOpen ? "translate-x-0 shadow-3" : "translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-end px-2">
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
            className="flex size-11 items-center justify-center"
          >
            <CloseIcon />
          </button>
        </div>
        <nav aria-label="Mobile" className="flex flex-1 flex-col items-center justify-center gap-2">
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              aria-current={isActive(pathname, href) ? "page" : undefined}
              className={`flex min-h-12 items-center text-h3 uppercase text-text-primary ${
                isActive(pathname, href) ? "underline decoration-accent decoration-2 underline-offset-8" : ""
              }`}
            >
              {label}
            </Link>
          ))}
          {/* Not in DESIGN.md §9, but mobile has no other route to the account. */}
          <Link href="/login" onClick={() => setMenuOpen(false)} className="mt-4 flex min-h-12 items-center text-nav uppercase text-text-secondary">
            Login / Register
          </Link>
        </nav>
        <div className="flex justify-center gap-3 pb-8">
          {SOCIAL_LINKS.map(({ label, href, icon }) => {
            const Icon = SOCIAL_ICONS[icon];
            return (
              <a key={label} href={href} aria-label={label} className="flex size-11 items-center justify-center">
                <Icon />
              </a>
            );
          })}
        </div>
      </div>
    </>
  );
}
