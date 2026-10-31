"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setOrderGift } from "@/app/(shell)/products/actions";
import { Toast, type ToastMessage } from "../Toast";

type Variant = { id: string; color: string; size: string; isGift: boolean };

// Which variant ships free with orders (pricing v2, ARCHITECTURE.md §5). One in the
// whole catalog; `elsewhere` names it when it's on another product. Saved on its own.
export function GiftVariantPicker({ productId, variants, elsewhere }: { productId: string; variants: Variant[]; elsewhere: string | null }) {
  const router = useRouter();
  const current = variants.find((v) => v.isGift)?.id ?? "";
  const [choice, setChoice] = useState(current);
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<ToastMessage | null>(null);

  if (!variants.length) return null;

  function save() {
    startTransition(async () => {
      const res = await setOrderGift(productId, choice || null);
      if (res.error) return setToast({ ok: false, text: res.error });
      setToast({ ok: true, text: choice ? "Đã chọn quà tặng kèm đơn" : "Đã bỏ quà tặng kèm đơn" });
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-sm border border-border bg-surface p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-card-title uppercase">Quà tặng kèm đơn</h2>
        <p id="gift-hint" className="text-stat-label text-text-secondary">
          Biến thể được tặng 1 cái cho mỗi đơn có sản phẩm &quot;Được freeship &amp; tặng tất&quot;, trừ vào tồn kho. Cả cửa hàng chỉ có 1 biến thể quà.
          {elsewhere && ` Hiện tại: ${elsewhere}. Chọn ở đây sẽ đổi quà sang biến thể này.`}
        </p>
      </div>
      <div className="flex gap-2">
        <label htmlFor="gift-variant" className="sr-only">Biến thể quà tặng</label>
        <select
          id="gift-variant" value={choice} onChange={(e) => setChoice(e.target.value)} aria-describedby="gift-hint"
          className="h-10 w-full rounded-sm border border-border bg-surface px-3 text-base md:text-input focus:border-text-primary focus:shadow-[0_0_0_2px_var(--color-accent-soft)] focus:outline-none"
        >
          <option value="">— Không phải quà —</option>
          {variants.map((v) => <option key={v.id} value={v.id}>{v.color} / {v.size}</option>)}
        </select>
        <button
          type="button" disabled={pending || choice === current} onClick={save}
          className="h-10 rounded-sm border border-text-primary px-4 text-button uppercase transition-colors duration-200 enabled:hover:bg-text-primary enabled:hover:text-text-on-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          Lưu
        </button>
      </div>
      <Toast toast={toast} setToast={setToast} />
    </section>
  );
}
