"use client";

import { useState, useTransition } from "react";
import { exportCustomers } from "@/app/(shell)/customers/export-actions";
import { downloadXlsx } from "@/lib/download";
import { Toast, type ToastMessage } from "../Toast";

// DASHBOARD_DESIGN.md §6.4 "List → Excel export": all customers, or the current search.
export function CustomersExport({ q }: { q: string }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const res = await exportCustomers({ q });
      if (res.file) downloadXlsx(res.file);
      else setToast({ ok: false, text: res.error ?? "Không thể xuất file. Vui lòng thử lại." });
    });
  }

  return (
    <>
      <button
        type="button" onClick={run} disabled={pending}
        className="ml-auto h-10 shrink-0 rounded-sm border border-text-primary px-4 text-button uppercase transition-colors duration-200 enabled:hover:bg-text-primary enabled:hover:text-text-on-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Đang tạo…" : "Xuất Excel"}
      </button>
      <Toast toast={toast} setToast={setToast} />
    </>
  );
}
