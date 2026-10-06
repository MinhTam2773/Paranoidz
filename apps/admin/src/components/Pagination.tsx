import Link from "next/link";

// DASHBOARD_DESIGN.md §5 Data table: "‹ 1 2 3 ›" bottom-right. `href(p)` builds the
// URL for page p with the list's other filters kept.
export function Pagination({ page, pages, href }: { page: number; pages: number; href: (page: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Phân trang" className="flex justify-end gap-1">
      {page > 1 && <PageLink href={href(page - 1)} label="Trang trước">‹</PageLink>}
      {Array.from({ length: pages }, (_, i) => i + 1)
        .filter((p) => Math.abs(p - page) <= 2 || p === 1 || p === pages)
        .map((p) => (
          <PageLink key={p} href={href(p)} current={p === page}>{p}</PageLink>
        ))}
      {page < pages && <PageLink href={href(page + 1)} label="Trang sau">›</PageLink>}
    </nav>
  );
}

function PageLink({ href, current, label, children }: { href: string; current?: boolean; label?: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={current ? "page" : undefined}
      className={`flex size-10 items-center justify-center rounded-sm border ${
        current ? "border-text-primary bg-text-primary text-text-on-dark" : "border-border bg-surface hover:border-border-hover"
      }`}
    >
      {children}
    </Link>
  );
}
