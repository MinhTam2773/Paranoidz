"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adjustStock } from "@/app/(shell)/inventory/actions";
import { ADJUST_REASONS, LOW_STOCK, signed } from "@/lib/inventory";
import { Toast, type ToastMessage } from "../Toast";

export type InventoryRowView = {
  id: string;
  productId: string;
  productName: string;
  active: boolean;
  color: string;
  size: string;
  sku: string | null;
  stock: number;
  pending: number; // what BigSeller still has to apply: adjustments + returns − website sales
  thumbUrl: string | null;
};

const control = "h-10 rounded-sm border border-border bg-surface text-base md:text-input focus:border-text-primary focus:outline-none";

// Rows with − / + / LƯU. Each save is one adjust_variant_stock() call; the page then
// reloads with fresh stock (an order may have changed it meanwhile).
export function InventoryTable({ rows }: { rows: InventoryRowView[] }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  return (
    <>
      <table className="hidden w-full overflow-hidden rounded-sm border border-border bg-surface md:table">
        <thead className="bg-bg-secondary text-left">
          <tr className="text-th uppercase text-text-secondary">
            <th scope="col" className="w-16 px-4 py-3"><span className="sr-only">Ảnh</span></th>
            <th scope="col" className="px-4 py-3">Sản phẩm · SKU</th>
            <th scope="col" className="px-4 py-3">Màu / Size</th>
            <th scope="col" className="px-4 py-3 text-right">Tồn kho</th>
            <th scope="col" className="px-4 py-3 text-right">Chờ gửi BigSeller</th>
            <th scope="col" className="px-4 py-3">Điều chỉnh</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border align-middle">
              <td className="px-4 py-2"><Thumb url={r.thumbUrl} /></td>
              <td className="px-4 py-2"><Name row={r} /></td>
              <td className="px-4 text-text-secondary">{r.color} / {r.size}</td>
              <td className="px-4 text-right"><Stock stock={r.stock} /></td>
              <td className="px-4 text-right">{r.pending ? signed(r.pending) : "—"}</td>
              <td className="px-4 py-2"><Adjust row={r} setToast={setToast} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-col gap-3 rounded-sm border border-border bg-surface p-3">
            <div className="flex gap-3">
              <Thumb url={r.thumbUrl} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Name row={r} />
                <span className="text-text-secondary">{r.color} / {r.size}</span>
                <span>Tồn kho <Stock stock={r.stock} />{r.pending ? <span className="text-text-secondary"> · chờ gửi {signed(r.pending)}</span> : null}</span>
              </div>
            </div>
            <Adjust row={r} setToast={setToast} />
          </li>
        ))}
      </ul>
      <Toast toast={toast} setToast={setToast} />
    </>
  );
}

function Thumb({ url }: { url: string | null }) {
  return (
    <span className="relative block aspect-3/4 w-10 shrink-0 overflow-hidden rounded-sm bg-bg-tertiary">
      {url && <Image src={url} alt="" fill sizes="40px" className="object-cover" />}
    </span>
  );
}

function Name({ row }: { row: InventoryRowView }) {
  return (
    <div className="flex min-w-0 flex-col">
      <Link href={`/products/${row.productId}`} className="font-semibold wrap-break-word hover:underline">{row.productName}</Link>
      <span className="text-stat-label text-text-secondary">
        {row.sku ?? "Chưa có SKU"}{!row.active && " · Đang ẩn"}
      </span>
    </div>
  );
}

function Stock({ stock }: { stock: number }) {
  if (stock === 0) return <span className="font-semibold text-accent">0 · Hết hàng</span>;
  if (stock <= LOW_STOCK) return <span className="font-semibold text-warning">{stock} · Sắp hết</span>;
  return <span className="font-semibold">{stock}</span>;
}

function Adjust({ row, setToast }: { row: InventoryRowView; setToast: (t: ToastMessage) => void }) {
  const router = useRouter();
  const [raw, setRaw] = useState("0");
  const [reason, setReason] = useState<string>(ADJUST_REASONS[0]);
  const [pending, startTransition] = useTransition();

  if (!row.sku) {
    return <Link href={`/products/${row.productId}`} className="text-stat-label text-text-secondary underline">Thêm SKU trong trang sản phẩm</Link>;
  }
  const delta = /^[+-]?\d{1,6}$/.test(raw.trim()) ? Number(raw.trim()) : NaN;
  const valid = Number.isInteger(delta) && delta !== 0 && row.stock + delta >= 0;
  const step = (by: number) => setRaw(String((Number.isNaN(delta) ? 0 : delta) + by));

  function save() {
    startTransition(async () => {
      const res = await adjustStock(row.id, delta, reason);
      if (res.error) return setToast({ ok: false, text: res.error });
      setToast({ ok: true, text: `${row.sku}: ${signed(delta)} → tồn kho ${res.stock}` });
      setRaw("0");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" aria-label={`Giảm ${row.sku}`} onClick={() => step(-1)} disabled={pending} className={`${control} w-10`}>−</button>
      <input
        aria-label={`Số lượng điều chỉnh cho ${row.sku}`} value={raw} inputMode="numeric" maxLength={7}
        onChange={(e) => setRaw(e.target.value)} disabled={pending} className={`${control} w-16 px-2 text-center`}
      />
      <button type="button" aria-label={`Tăng ${row.sku}`} onClick={() => step(1)} disabled={pending} className={`${control} w-10`}>+</button>
      <select aria-label={`Lý do điều chỉnh ${row.sku}`} value={reason} onChange={(e) => setReason(e.target.value)} disabled={pending} className={`${control} px-2`}>
        {ADJUST_REASONS.map((r) => <option key={r}>{r}</option>)}
      </select>
      <button
        type="button" onClick={save} disabled={!valid || pending}
        className="h-10 rounded-sm bg-accent px-4 text-button uppercase text-text-on-dark transition-colors duration-200 enabled:hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Đang lưu…" : "Lưu"}
      </button>
      {valid && <span className="text-stat-label text-text-secondary">→ {row.stock + delta}</span>}
    </div>
  );
}
