"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { confirmBankTransferPayment } from "@/app/(shell)/orders/[number]/actions";
import { Toast, type ToastMessage } from "../Toast";

const button = "h-10 w-full rounded-sm px-4 text-button uppercase transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50";
const primaryClass = `${button} bg-accent text-text-on-dark enabled:hover:bg-accent-hover`;
const ghostClass = `${button} text-text-secondary enabled:hover:text-text-primary`;

// Bank-transfer orders only: confirms the shop has received the money, so the
// order can enter the normal pending -> confirmed -> shipped flow (DASHBOARD_DESIGN.md §5 Modal, §7).
export function PaymentConfirmButton({ orderId, orderNumber }: { orderId: string; orderNumber: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) dialogRef.current?.close();
  }, [open]);

  function confirm() {
    startTransition(async () => {
      const { error } = await confirmBankTransferPayment(orderId);
      // Post-await updates must re-enter the transition to land with the new page.
      startTransition(() => {
        setOpen(false);
        setToast(error ? { ok: false, text: error } : { ok: true, text: `${orderNumber}: đã xác nhận nhận tiền chuyển khoản.` });
      });
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); dialogRef.current?.showModal(); }}
        disabled={pending}
        className={primaryClass}
      >
        Xác nhận đã nhận tiền
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="payment-confirm-title"
        onCancel={(e) => pending && e.preventDefault()}
        onClose={() => setOpen(false)}
        className="m-auto w-[calc(100%-2rem)] max-w-[480px] rounded-sm bg-surface p-6 text-text-primary shadow-2 backdrop:bg-bg-dark/50"
      >
        {open && (
          <div className="flex flex-col gap-4">
            <h2 id="payment-confirm-title" className="text-card-title uppercase">Xác nhận đã nhận tiền chuyển khoản cho {orderNumber}?</h2>
            <p className="text-text-secondary">
              Sau khi xác nhận, đơn sẽ vào luồng xử lý thường và có thể tạo vận đơn SPX. Chỉ xác nhận khi tiền đã về tài khoản.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => dialogRef.current?.close()} disabled={pending} className={`${ghostClass} sm:w-auto`}>
                Quay lại
              </button>
              <button type="button" onClick={confirm} disabled={pending} className={`${primaryClass} sm:w-auto`}>
                {pending ? "Đang cập nhật…" : "Xác nhận đã nhận tiền"}
              </button>
            </div>
          </div>
        )}
      </dialog>

      <Toast toast={toast} setToast={setToast} />
    </>
  );
}
