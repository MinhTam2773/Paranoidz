import type { KeyboardEvent, ReactNode, Ref } from "react";

export type ProductTab = { id: string; label: string; content: ReactNode };

// Detailed-info tabs under the product (Stitch PDP). Controlled, so the size-guide link
// beside the size picker can open its tab. ARIA tabs pattern: ←/→ move between tabs.
// Inactive panels stay in the HTML (hidden) so their content is still server-rendered.
export function ProductTabs({
  tabs,
  active,
  onChange,
  ref,
}: {
  tabs: ProductTab[];
  active: string;
  onChange: (id: string) => void;
  ref?: Ref<HTMLElement>;
}) {
  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = tabs.findIndex((t) => t.id === active);
    const next = tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
    onChange(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  }

  return (
    <section ref={ref} className="mt-16 scroll-mt-36">
      <div role="tablist" aria-label="Product information" onKeyDown={onKeyDown} className="flex border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={t.id === active}
            aria-controls={`panel-${t.id}`}
            tabIndex={t.id === active ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={`-mb-px border-b-2 px-4 py-4 text-nav font-bold uppercase transition-colors duration-200 lg:px-8 ${
              t.id === active
                ? "border-text-primary text-text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          id={`panel-${t.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${t.id}`}
          hidden={t.id !== active}
          className="max-w-3xl py-8 lg:py-12"
        >
          {t.content}
        </div>
      ))}
    </section>
  );
}
