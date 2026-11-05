"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { GachaSection } from "@/components/home/GachaSection";

// "Chơi là có quà" as a floating gift button in the bottom-right corner of every page (2026-11-05,
// owner's request; it used to be a homepage section). The game mounts on the first open, so pages
// where nobody opens it never call the gacha server actions, and it stays mounted afterwards so
// closing the panel mid-spin doesn't lose the result on screen. Hidden on checkout; lifted above
// the product page's fixed buy bar (PurchaseActions, z-30).
export function GachaFloat() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Leaving the page (e.g. a mission's "Đi xem" link) closes the panel.
  const [shownPath, setShownPath] = useState(pathname);
  if (shownPath !== pathname) {
    setShownPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (pathname.startsWith("/checkout")) return null;
  const onProduct = /^\/products\/[^/]+/.test(pathname);

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => {
            setMounted(true);
            setOpen(true);
          }}
          aria-label="Chơi là có quà"
          className={`fixed right-4 z-40 flex items-center gap-2 rounded-full border border-[#f5b301]/60 bg-[#0b0c12] p-3 text-text-on-dark shadow-2 transition-transform duration-200 hover:-translate-y-0.5 sm:py-2.5 sm:pr-4 sm:pl-3 ${
            onProduct ? "bottom-24" : "bottom-4"
          }`}
        >
          <svg viewBox="0 0 24 24" aria-hidden className="size-6 shrink-0" fill="none" stroke="#f5b301" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="8" width="18" height="4" rx="1" />
            <path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
            <path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5" />
          </svg>
          <span className="hidden text-[13px] font-bold uppercase sm:inline">
            Chơi là <span className="text-[#f5b301]">có quà</span>
          </span>
        </button>
      )}

      {mounted && (
        // No transform on the panel: the missions modal inside is `position: fixed` and would be
        // trapped by a transformed ancestor.
        <div
          role="dialog"
          aria-label="Chơi là có quà"
          hidden={!open}
          className="fixed inset-x-0 bottom-0 z-[45] max-h-[88vh] overflow-y-auto rounded-t-2xl bg-[#0b0c12] shadow-2 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[400px] sm:rounded-2xl"
        >
          <button
            type="button"
            aria-label="Đóng"
            onClick={() => setOpen(false)}
            className="absolute right-2.5 top-2.5 z-10 flex size-[29px] items-center justify-center rounded-full bg-text-on-dark/10 text-[13px] font-extrabold text-text-on-dark"
          >
            ✕
          </button>
          <GachaSection />
        </div>
      )}
    </>
  );
}
