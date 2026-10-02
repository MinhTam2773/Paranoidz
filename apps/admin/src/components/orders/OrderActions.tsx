"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { transitionOrder } from "@/app/(shell)/orders/[number]/actions";
import { ORDER_ACTIONS, STATUS_LABEL, type OrderAction, type OrderStatus } from "@/lib/order-status";

const button = "h-10 w-full rounded-sm px-4 text-button uppercase transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50";
const primaryClass = `${button} bg-accent text-text-on-dark enabled:hover:bg-accent-hover`;
const ghostClass = `${button} text-text-secondary enabled:hover:text-text-primary`;
const destructiveClass = `${button} border border-accent text-accent enabled:hover:bg-accent enabled:hover:text-text-on-dark`;

// Next lifecycle step + Cancel / Delivery failed, each confirmed in a modal that
// names the order (DASHBOARD_DESIGN.md §5 Modal, §7). Result shown as a toast.
export function OrderActions({ orderId, orderNumber, status }: { orderId: string; orderNumber: string; status: OrderStatus }) {
  const { primary, secondary } = ORDER_ACTIONS[status];
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [action, setAction] = useState<OrderAction | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Closed from state, not inside the transition callback: close() there runs at
  // once, before the revalidated page (with the new status) has arrived.
  useEffect(() => {
    if (!action) dialogRef.current?.close();
  }, [action]);

  function open(a: OrderAction) {
    setAction(a);
    dialogRef.current?.showModal();
  }

  function confirm() {
    if (!action) return;
    startTransition(async () => {
      const { error } = await transitionOrder(orderId, action.to);
      // Post-await updates must re-enter the transition to land with the new page.
      startTransition(() => {
        setAction(null);
        setToast(error ? { ok: false, text: error } : { ok: true, text: `${orderNumber}: ${STATUS_LABEL[action.to]}` });
      });
    });
  }

  return (
    <>
      {primary || secondary.length ? (
        <div className="flex flex-col gap-2">
          {primary && <button type="button" onClick={() => open(primary)} disabled={pending} className={primaryClass}>{primary.label}</button>}
          {secondary.map((a) => (
            <button key={a.to} type="button" onClick={() => open(a)} disabled={pending} className={ghostClass}>{a.label}</button>
          ))}
        </div>
      ) : (
        <p className="text-text-secondary">Đơn đã kết thúc, không còn thao tác nào.</p>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby="order-action-title"
        onCancel={(e) => pending && e.preventDefault()}
        className="m-auto w-[calc(100%-2rem)] max-w-[480px] rounded-sm bg-surface p-6 text-text-primary shadow-2 backdrop:bg-bg-dark/50"
      >
        {action && (
          <div className="flex flex-col gap-4">
            <h2 id="order-action-title" className="text-card-title uppercase">{action.label} {orderNumber}?</h2>
            <p className="text-text-secondary">{action.body}</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => dialogRef.current?.close()} disabled={pending} className={`${ghostClass} sm:w-auto`}>
                Quay lại
              </button>
              <button type="button" onClick={confirm} disabled={pending} className={`${action.destructive ? destructiveClass : primaryClass} sm:w-auto`}>
                {pending ? "Đang cập nhật…" : action.label}
              </button>
            </div>
          </div>
        )}
      </dialog>

      {toast && (
        <div role="status" className="fixed right-4 bottom-4 z-50 flex max-w-[calc(100%-2rem)] gap-2 rounded-sm bg-bg-dark px-4 py-3 text-text-on-dark shadow-2">
          <span aria-hidden="true" className={toast.ok ? "text-success" : "text-accent"}>{toast.ok ? "✓" : "✕"}</span>
          {toast.text}
        </div>
      )}
    </>
  );
}
