"use client";

import { useState } from "react";
import { HOTLINE } from "@/lib/site";
import { CloseIcon } from "./icons";

const ITEMS = [
  "Thanh toán COD — nhận hàng rồi mới trả tiền",
  `Hotline: ${HOTLINE}`,
  "Giao hàng toàn quốc qua SPX Express",
  "Bộ sưu tập mới 2026 đã lên kệ",
];

// Redesign 2026-10-16: slow marquee ticker instead of the static red bar —
// a streetwear staple, calmer than the old solid-red strip. Black on white
// keeps the accent red reserved for CTAs and sale badges (DESIGN.md §2).
export function AnnouncementBar() {
  const [open, setOpen] = useState(true);
  if (!open) return null;

  const row = [...ITEMS, ...ITEMS, ...ITEMS];
  return (
    <div className="relative overflow-hidden border-b border-border bg-bg-dark text-text-on-dark">
      <div className="flex w-max animate-ticker items-center py-2 hover:[animation-play-state:paused]">
        {[0, 1].map((half) => (
          <div key={half} aria-hidden={half === 1} className="flex w-max items-center">
            {row.map((item, i) => (
              <span key={`${half}-${i}`} className="flex items-center text-caption uppercase tracking-[0.08em]">
                <span className="px-6">{item}</span>
                <span aria-hidden className="text-accent">●</span>
              </span>
            ))}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Đóng thông báo"
        className="absolute right-0 top-0 flex h-full min-h-11 w-11 items-center justify-center bg-bg-dark"
      >
        <CloseIcon width={14} height={14} />
      </button>
    </div>
  );
}
