"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { renameColor } from "@/app/(shell)/products/actions";
import { Toast, type ToastMessage } from "../Toast";

const input =
  "h-10 w-full rounded-sm border border-border bg-surface px-3 text-base md:text-input focus:border-text-primary focus:shadow-[0_0_0_2px_var(--color-accent-soft)] focus:outline-none";

// Rename a colour on all its sizes and photos at once (DASHBOARD_DESIGN.md §6.3).
// Saved on its own, outside the product form; the page reloads with the new names.
export function ColorRename({ productId, colors }: { productId: string; colors: string[] }) {
  const router = useRouter();
  const [names, setNames] = useState<Record<string, string>>(() => Object.fromEntries(colors.map((c) => [c, c])));
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<ToastMessage | null>(null);

  if (!colors.length) return null;

  function rename(from: string) {
    const to = (names[from] ?? "").trim();
    startTransition(async () => {
      const res = await renameColor(productId, from, to);
      if (res.error) return setToast({ ok: false, text: res.error });
      setToast({ ok: true, text: `Đã đổi "${from}" thành "${to}"` });
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-sm border border-border bg-surface p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-card-title uppercase">Màu sắc</h2>
        <p className="text-stat-label text-text-secondary">Đổi tên màu cho mọi size và ảnh của màu đó. SKU không đổi; đơn hàng cũ giữ tên màu lúc đặt. Lưu các thay đổi bên dưới trước khi đổi tên — trang sẽ tải lại.</p>
      </div>
      <ul className="flex flex-col gap-2">
        {colors.map((c) => {
          const value = names[c] ?? c;
          const unchanged = value.trim() === c || !value.trim();
          return (
            <li key={c} className="grid grid-cols-[1fr_auto] items-center gap-2 md:grid-cols-[160px_1fr_auto]">
              <span className="col-span-2 font-medium wrap-break-word md:col-span-1">{c}</span>
              <label className="sr-only" htmlFor={`color-${c}`}>Tên mới cho màu {c}</label>
              <input
                id={`color-${c}`} value={value} maxLength={40}
                onChange={(e) => setNames((n) => ({ ...n, [c]: e.target.value }))}
                className={input}
              />
              <button
                type="button" disabled={pending || unchanged} onClick={() => rename(c)}
                className="h-10 rounded-sm border border-text-primary px-4 text-button uppercase transition-colors duration-200 enabled:hover:bg-text-primary enabled:hover:text-text-on-dark disabled:cursor-not-allowed disabled:opacity-40"
              >
                Đổi tên
              </button>
            </li>
          );
        })}
      </ul>
      <Toast toast={toast} setToast={setToast} />
    </section>
  );
}
