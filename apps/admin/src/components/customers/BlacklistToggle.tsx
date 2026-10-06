"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { setBlacklisted } from "@/app/(shell)/customers/actions";
import { formatPhone } from "@/lib/format";
import { Toast, type ToastMessage } from "../Toast";

// Blacklist on/off behind a confirmation modal that names the phone (DASHBOARD_DESIGN.md §6.4, §7).
export function BlacklistToggle({ phone, name, blacklisted }: { phone: string; name: string; blacklisted: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [pending, startTransition] = useTransition();

  // Closed from state so it closes together with the revalidated page.
  useEffect(() => {
    if (open) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [open]);

  function confirm() {
    startTransition(async () => {
      const { error } = await setBlacklisted(phone, !blacklisted);
      startTransition(() => {
        setOpen(false);
        setToast(error ? { ok: false, text: error } : { ok: true, text: blacklisted ? "Đã gỡ khỏi danh sách đen" : "Đã thêm vào danh sách đen" });
      });
    });
  }

  const label = blacklisted ? "Gỡ khỏi danh sách đen" : "Thêm vào danh sách đen";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`h-10 w-full rounded-sm border px-4 text-button uppercase transition-colors duration-200 ${
          blacklisted
            ? "border-text-primary hover:bg-text-primary hover:text-text-on-dark"
            : "border-accent text-accent hover:bg-accent hover:text-text-on-dark"
        }`}
      >
        {label}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="blacklist-title"
        onCancel={(e) => (pending ? e.preventDefault() : setOpen(false))}
        className="m-auto w-[calc(100%-2rem)] max-w-[480px] rounded-sm bg-surface p-6 text-text-primary shadow-2 backdrop:bg-bg-dark/50"
      >
        {open && (
          <div className="flex flex-col gap-4">
            <h2 id="blacklist-title" className="text-card-title uppercase">{label}: {name} ({formatPhone(phone)})?</h2>
            <p className="text-text-secondary">
              {blacklisted
                ? "Số điện thoại này sẽ đặt hàng lại được."
                : "Số điện thoại này sẽ không đặt được đơn mới (dù nhập theo định dạng nào). Các đơn đã có không bị ảnh hưởng."}
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setOpen(false)} disabled={pending} className="h-10 rounded-sm px-4 text-button uppercase text-text-secondary hover:text-text-primary disabled:opacity-50">
                Quay lại
              </button>
              <button
                type="button" onClick={confirm} disabled={pending}
                className={`h-10 rounded-sm px-4 text-button uppercase transition-colors duration-200 disabled:opacity-50 ${
                  blacklisted ? "bg-accent text-text-on-dark enabled:hover:bg-accent-hover" : "border border-accent text-accent enabled:hover:bg-accent enabled:hover:text-text-on-dark"
                }`}
              >
                {pending ? "Đang lưu…" : label}
              </button>
            </div>
          </div>
        )}
      </dialog>
      <Toast toast={toast} setToast={setToast} />
    </>
  );
}
