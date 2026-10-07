"use client";

import { useState, useTransition } from "react";
import { Toast, type ToastMessage } from "./Toast";

// Inline on/off for an is_active column (products §6.3, collections §6.6).
// `setActive` is a server action bound to the row's id. Sits above the row's
// stretched link (relative z-10) so it doesn't open the row.
export function ActiveToggle({ name, active, label, offLabel = "đã ẩn", setActive }: {
  name: string;
  active: boolean;
  label: string; // what "on" means, e.g. "Đang bán"
  offLabel?: string; // toast after switching off
  setActive: (active: boolean) => Promise<{ error?: string }>;
}) {
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<ToastMessage | null>(null);

  function toggle() {
    startTransition(async () => {
      const { error } = await setActive(!active);
      startTransition(() => setToast(error ? { ok: false, text: error } : { ok: true, text: `${name}: ${active ? offLabel : label.toLowerCase()}` }));
    });
  }

  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={active}
        aria-label={`${label}: ${name}`}
        onClick={toggle}
        disabled={pending}
        className="relative z-10 flex h-11 items-center disabled:opacity-50"
      >
        <span className={`flex h-6 w-11 items-center rounded-sm p-0.5 transition-colors duration-200 ${active ? "bg-text-primary" : "bg-bg-tertiary"}`}>
          <span className={`size-5 rounded-sm bg-surface shadow-1 transition-transform duration-200 ${active ? "translate-x-5" : ""}`} />
        </span>
      </button>
      <Toast toast={toast} setToast={setToast} />
    </>
  );
}
