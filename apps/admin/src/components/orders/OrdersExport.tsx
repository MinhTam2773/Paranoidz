"use client";

import { useState, useTransition } from "react";
import { exportOrders } from "@/app/(shell)/orders/export-actions";
import { downloadXlsx } from "@/lib/download";
import { Toast, type ToastMessage } from "../Toast";

const secondary = "h-10 shrink-0 rounded-sm border border-text-primary px-4 text-button uppercase transition-colors duration-200 hover:bg-text-primary hover:text-text-on-dark";
const input = "h-10 rounded-sm border border-border bg-surface px-3 text-base focus:border-text-primary focus:shadow-[0_0_0_2px_var(--color-accent-soft)] focus:outline-none md:text-input";

// DASHBOARD_DESIGN.md §6.2 "List → Excel export": a date range on top of the tab + search on screen.
// Rendered inside the search row (flex-wrap); the open panel takes a line of its own.
export function OrdersExport({ status, tabLabel, q, defaultFrom, defaultTo }: {
  status: string | null; tabLabel: string; q: string; defaultFrom: string; defaultTo: string;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const res = await exportOrders({ from, to, status, q });
      if (res.file) downloadXlsx(res.file);
      else setToast({ ok: false, text: res.error ?? "Không thể xuất file. Vui lòng thử lại." });
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className={`${secondary} ml-auto`}>
        Xuất Excel
      </button>
      {open && (
        <div className="flex basis-full flex-wrap items-end gap-3 rounded-sm border border-border bg-surface p-4">
          <label className="flex flex-col gap-1 text-label uppercase text-text-secondary">
            Từ ngày
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={`${input} normal-case text-text-primary`} />
          </label>
          <label className="flex flex-col gap-1 text-label uppercase text-text-secondary">
            Đến ngày
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={`${input} normal-case text-text-primary`} />
          </label>
          <button
            type="button" onClick={run} disabled={pending || !from || !to}
            className="h-10 rounded-sm bg-accent px-6 text-button uppercase text-text-on-dark transition-colors duration-200 enabled:hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Đang tạo…" : "Tải file"}
          </button>
          <p className="basis-full wrap-break-word text-text-secondary">
            Theo tab đang xem: {tabLabel}{q && ` · tìm "${q}"`}. File có số điện thoại và địa chỉ của khách: chỉ lưu trên máy của bạn.
          </p>
        </div>
      )}
      <Toast toast={toast} setToast={setToast} />
    </>
  );
}
