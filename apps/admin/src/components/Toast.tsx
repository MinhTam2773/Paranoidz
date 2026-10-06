"use client";

import { useEffect } from "react";

export type ToastMessage = { ok: boolean; text: string };

// DASHBOARD_DESIGN.md §5: bottom-right, dark, 3s auto-dismiss, ✓ / ✕ prefix.
// `setToast` is the parent's state setter (stable, so the timer isn't reset on re-render).
export function Toast({ toast, setToast }: { toast: ToastMessage | null; setToast: (t: null) => void }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast, setToast]);

  if (!toast) return null;
  return (
    <div role="status" className="fixed right-4 bottom-4 z-50 flex max-w-[calc(100%-2rem)] gap-2 rounded-sm bg-bg-dark px-4 py-3 text-text-on-dark shadow-2">
      <span aria-hidden="true" className={toast.ok ? "text-success" : "text-accent"}>{toast.ok ? "✓" : "✕"}</span>
      {toast.text}
    </div>
  );
}
