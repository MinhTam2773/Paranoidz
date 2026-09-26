import Link from "next/link";

// Inner-page path subheader, DESIGN.md §4. The last item (no href) is the current page.
export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="py-3">
      <ol className="flex flex-wrap items-center text-nav font-normal uppercase">
        {items.map(({ label, href }, i) => (
          <li key={label} className="flex items-center">
            {i > 0 && (
              <span aria-hidden="true" className="px-2 text-text-muted">
                /
              </span>
            )}
            {href ? (
              <Link href={href} className="text-text-secondary transition-colors duration-200 hover:text-text-primary">
                {label}
              </Link>
            ) : (
              <span aria-current="page" className="text-text-primary">
                {label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
