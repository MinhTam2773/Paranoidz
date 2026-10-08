"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";

type HomeTab = { id: string; label: string; content: ReactNode };

// DESIGN.md §4 NEW GOODS / BEST SELLER switcher: filled pill for the active tab. The panels are
// server-rendered and passed in; inactive ones stay in the HTML (hidden). ←/→ move between tabs.
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
      <div role="tablist" aria-label="Sản phẩm" onKeyDown={onKeyDown} className="mb-6 flex justify-center gap-2">
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
            className={`h-11 rounded-sm px-6 text-nav font-bold uppercase transition-colors duration-200 ${
              t.id === active ? "bg-text-primary text-text-on-dark" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {t.label}
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
