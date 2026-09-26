import { SearchIcon } from "./icons";

// Plain GET form: works without JS. /search is built in the search task.
export function SearchForm({ autoFocus }: { autoFocus?: boolean }) {
  return (
    <form action="/search" role="search" className="relative w-full">
      <SearchIcon
        width={18}
        height={18}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
      />
      <input
        type="search"
        name="q"
        autoFocus={autoFocus}
        placeholder="Search product..."
        aria-label="Search products"
        className="h-11 w-full rounded-sm border border-border bg-bg-secondary pl-10 pr-4 text-product-name text-text-primary placeholder:text-text-muted focus:border-text-primary focus:shadow-[0_0_0_2px_var(--color-accent-soft)] focus:outline-none"
      />
    </form>
  );
}
