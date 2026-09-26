"use client";

import { useState } from "react";
import { HOTLINE } from "@/lib/site";
import { CloseIcon } from "./icons";

// DESIGN.md §4. No free-shipping message until ARCHITECTURE.md §8.1 is decided.
export function AnnouncementBar() {
  const [open, setOpen] = useState(true);
  if (!open) return null;

  return (
    <div className="relative bg-accent text-text-on-dark">
      <p className="mx-auto max-w-7xl px-12 py-2 text-center text-caption uppercase">
        Cash on delivery · Hotline: {HOTLINE}
      </p>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Dismiss announcement"
        className="absolute right-0 top-0 flex h-full min-h-11 w-11 items-center justify-center"
      >
        <CloseIcon width={16} height={16} />
      </button>
    </div>
  );
}
