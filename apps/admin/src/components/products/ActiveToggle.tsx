"use client";

import { useState, useTransition } from "react";
import { setProductActive } from "@/app/(shell)/products/actions";
import { Toast, type ToastMessage } from "../Toast";

// Inline on/off for products.is_active (DASHBOARD_DESIGN.md §6.3). Sits above the
// row's stretched link (relative z-10) so it doesn't open the product.
export function ActiveToggle({ id, name, active }: { id: string; name: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<ToastMessage | null>(null);

  function toggle() {
    startTransition(async () => {
      const { error } = await setProductActive(id, !active);
      startTransition(() => setToast(error ? { ok: false, text: error } : { ok: true, text: `${name}: ${active ? "đã ẩn" : "đang bán"}` }));
    });
  }

  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={active}
        aria-label={`Đang bán: ${name}`}
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
