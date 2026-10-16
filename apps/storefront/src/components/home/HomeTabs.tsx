"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";

type HomeTab = { id: string; label: string; content: ReactNode };

// Redesign 2026-10-16: editorial tab headers — large uppercase type with an
// accent underline for the active tab, left-aligned like a magazine section
// head. Same keyboard behavior as before.
export function HomeTabs({ tabs }: { tabs: HomeTab[] }) {
  const [active, setActive] = useState(tabs[0].id);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = tabs.findIndex((t) => t.id === active);
    const next = tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
    setActive(next.id);
    document.getElementById(`home-tab-${next.id}`)?.focus();
  }

  return (
    <section>
      <div role="tablist" aria-label="Sản phẩm" onKeyDown={onKeyDown} className="mb-8 flex items-baseline gap-8 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`home-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={t.id === active}
            aria-controls={`home-panel-${t.id}`}
            tabIndex={t.id === active ? 0 : -1}
            onClick={() => setActive(t.id)}
            className={`relative -mb-px pb-4 text-h3 uppercase transition-colors duration-200 ${
              t.id === active ? "text-text-primary" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {t.label}
            {t.id === active && <span aria-hidden className="absolute inset-x-0 -bottom-px h-[3px] bg-accent" />}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} id={`home-panel-${t.id}`} role="tabpanel" aria-labelledby={`home-tab-${t.id}`} hidden={t.id !== active}>
          {t.content}
        </div>
      ))}
    </section>
  );
}
