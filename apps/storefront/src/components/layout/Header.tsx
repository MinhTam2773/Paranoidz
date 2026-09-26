import Link from "next/link";
import { HOTLINE } from "@/lib/site";
import { CartLink } from "./CartLink";
import { UserIcon } from "./icons";
import { MobileNav } from "./MobileNav";
import { NavLinks } from "./NavLinks";
import { SearchForm } from "./SearchForm";

// Two-row sticky header, DESIGN.md §4. Desktop (≥1024px): Row 1 logo | search | hotline,
// login, cart; Row 2 nav links. Below that: logo | search, cart, hamburger.
export function Header() {
  return (
    <header className="sticky top-0 z-40 bg-bg-primary">
      <div className="relative border-b border-border">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 lg:gap-12 lg:px-6">
          <Link
            href="/"
            className="mr-auto font-logo text-h3 italic uppercase tracking-[0.05em] text-text-primary lg:mr-0 lg:text-h2 lg:tracking-[0.05em]"
          >
            Paranoidz
          </Link>

          <div className="hidden flex-1 lg:block">
            <div className="mx-auto max-w-xl">
              <SearchForm />
            </div>
          </div>

          <div className="flex items-center gap-2 lg:gap-6">
            <span className="hidden text-nav uppercase text-text-primary lg:inline">Hotline: {HOTLINE}</span>
            <Link href="/login" className="hidden items-center gap-2 text-nav uppercase text-text-primary lg:flex">
              <UserIcon width={20} height={20} />
              Login / Register
            </Link>
            <CartLink />
            <MobileNav />
          </div>
        </div>
      </div>
      <NavLinks />
    </header>
  );
}
