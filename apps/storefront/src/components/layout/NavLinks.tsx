"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LINKS } from "@/lib/site";

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

// Desktop Row 2 (DESIGN.md §4): grey → black on hover, active = black + 2px red underline.
export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="hidden h-12 items-center justify-center gap-10 border-b border-border lg:flex">
      {NAV_LINKS.map(({ label, href }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex h-full items-center border-b-2 text-nav uppercase transition-colors duration-200 ${
              active
                ? "border-accent text-text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
