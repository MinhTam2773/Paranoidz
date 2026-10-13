"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { renameColor, setColorHex } from "@/app/(shell)/products/actions";
import { Toast, type ToastMessage } from "../Toast";

const input =
  "h-10 w-full rounded-sm border border-border bg-surface px-3 text-base md:text-input focus:border-text-primary focus:shadow-[0_0_0_2px_var(--color-accent-soft)] focus:outline-none";

type Color = { name: string; hex: string | null };

// Rename a colour and pick its swatch (storefront card dots) on all its sizes at once
// (DASHBOARD_DESIGN.md §6.3). Saved on its own, outside the product form; the page reloads
// with the new values. The hex is saved under the old name first, so a rename carries it.
export function ColorRename({ productId, colors }: { productId: string; colors: Color[] }) {
  const router = useRouter();
  const [edits, setEdits] = useState<Record<string, Color>>(() => Object.fromEntries(colors.map((c) => [c.name, c])));
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<ToastMessage | null>(null);

  if (!colors.length) return null;

  const edit = (name: string, patch: Partial<Color>) => setEdits((e) => ({ ...e, [name]: { ...e[name], ...patch } }));

  function save(c: Color) {
    const to = edits[c.name].name.trim();
    const hex = edits[c.name].hex;
    startTransition(async () => {
      if (hex !== c.hex) {
        const res = await setColorHex(productId, c.name, hex);
        if (res.error) return setToast({ ok: false, text: res.error });
      }
      if (to !== c.name) {
        const res = await renameColor(productId, c.name, to);
        if (res.error) return setToast({ ok: false, text: res.error });
      }
      setToast({ ok: true, text: `Đã lưu màu "${to}"` });
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-sm border border-border bg-surface p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-card-title uppercase">Màu sắc</h2>
        <p className="text-stat-label text-text-secondary">Đổi tên màu và chọn màu hiển thị (chấm màu trên thẻ sản phẩm) cho mọi size của màu đó. Không chọn thì thẻ hiện tên màu. SKU không đổi; đơn hàng cũ giữ tên màu lúc đặt. Lưu các thay đổi bên dưới trước — trang sẽ tải lại.</p>
      </div>
      <ul className="flex flex-col gap-2">
        {colors.map((c) => {
          const { name, hex } = edits[c.name];
          const unchanged = (name.trim() === c.name && hex === c.hex) || !name.trim();
          return (
            <li key={c.name} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 md:grid-cols-[160px_auto_1fr_auto]">
              <span className="col-span-3 font-medium wrap-break-word md:col-span-1">{c.name}</span>
              <div className="flex items-center gap-1">
                {/* Native picker behind a circle: dashed while no colour is chosen. */}
                <label
                  className={`relative size-10 cursor-pointer rounded-full border ${hex ? "border-border" : "border-dashed border-text-muted"}`}
                  style={hex ? { backgroundColor: hex } : undefined}
                >
                  <span className="sr-only">Màu hiển thị cho {c.name}</span>
                  <input
                    type="color" value={hex ?? "#000000"}
                    onChange={(e) => edit(c.name, { hex: e.target.value.toLowerCase() })}
                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                  />
                </label>
                {hex && (
                  <button type="button" onClick={() => edit(c.name, { hex: null })} className="px-1 text-stat-label text-text-secondary underline underline-offset-2 hover:text-text-primary">
                    Bỏ màu
                  </button>
                )}
              </div>
              <label className="sr-only" htmlFor={`color-${c.name}`}>Tên mới cho màu {c.name}</label>
              <input
                id={`color-${c.name}`} value={name} maxLength={40}
                onChange={(e) => edit(c.name, { name: e.target.value })}
                className={input}
              />
              <button
                type="button" disabled={pending || unchanged} onClick={() => save(c)}
                className="h-10 rounded-sm border border-text-primary px-4 text-button uppercase transition-colors duration-200 enabled:hover:bg-text-primary enabled:hover:text-text-on-dark disabled:cursor-not-allowed disabled:opacity-40"
              >
                Lưu
              </button>
            </li>
          );
        })}
      </ul>
      <Toast toast={toast} setToast={setToast} />
    </section>
  );
}
