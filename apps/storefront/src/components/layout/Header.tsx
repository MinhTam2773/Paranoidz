"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LINKS } from "@/lib/site";
import { AccountLink } from "./AccountLink";
import { CartLink } from "./CartLink";
import { MobileNav } from "./MobileNav";
import { SearchForm } from "./SearchForm";
import { isActive } from "./NavLinks";

// Redesign 2026-10-16: one sticky row instead of two — wordmark left, nav inline
// center, search + account + cart right. Frees vertical space and reads more
// editorial; the old second row felt corporate.
export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg-primary/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 lg:h-[72px] lg:gap-8 lg:px-6">
        <Link
          href="/"
          className="font-logo text-[26px] italic uppercase leading-none tracking-[0.05em] text-text-primary lg:text-[32px]"
        >
          Paranoidz
        </Link>

        <nav aria-label="Menu chính" className="hidden items-center gap-7 lg:flex">
          {NAV_LINKS.slice(1, 5).map(({ label, href }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative py-1 text-nav uppercase transition-colors duration-200 ${
                  active ? "text-text-primary" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {label}
                {active && <span aria-hidden className="absolute inset-x-0 -bottom-0.5 h-0.5 bg-accent" />}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto hidden w-56 lg:block xl:w-64">
          <SearchForm />
        </div>

        <div className="ml-auto flex items-center gap-1 lg:ml-0 lg:gap-2">
          <AccountLink icon className="hidden items-center gap-2 text-nav uppercase text-text-primary lg:flex" />
          <CartLink />
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
