"use client";

import { useState, useTransition } from "react";
import { moveReturn } from "@/app/(shell)/returns/[id]/actions";
import { RETURN_STEPS, type ReturnStatus, type ReturnStep } from "@/lib/returns";
import { formatVnd } from "@/lib/format";
import { Toast, type ToastMessage } from "../Toast";

const button = "h-10 w-full rounded-sm px-4 text-button uppercase transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50";
const primaryClass = `${button} bg-accent text-text-on-dark enabled:hover:bg-accent-hover`;
const ghostClass = `${button} text-text-secondary enabled:hover:text-text-primary`;
const destructiveClass = `${button} border border-accent text-accent enabled:hover:bg-accent enabled:hover:text-text-on-dark`;
const inputClass =
  "h-10 w-full rounded-sm border border-border bg-surface px-3 text-base focus:border-text-primary focus:shadow-[0_0_0_2px_var(--color-accent-soft)] focus:outline-none md:text-input";
const labelClass = "text-label uppercase text-text-secondary";

const STEP: Record<ReturnStep, { to: ReturnStatus; label: string; body: string; kind: "primary" | "ghost" | "destructive" }> = {
  approve: { to: "approved", label: "Duyệt yêu cầu", body: "Khách sẽ thấy yêu cầu đã được duyệt. Bước tiếp theo: tạo đơn SPX lấy hàng.", kind: "primary" },
  pickup: { to: "pickup_booked", label: "Đã tạo đơn lấy hàng", body: "Tạo đơn SPX lấy hàng tại địa chỉ của khách (trong app SPX), rồi nhập mã vận đơn.", kind: "primary" },
  receive: { to: "received", label: "Đã nhận hàng (đạt)", body: "Hàng đã về và đạt điều kiện (chưa giặt, còn tem mác). Số lượng trả được cộng lại vào tồn kho.", kind: "primary" },
  refund: { to: "refunded", label: "Đã hoàn tiền", body: "Ghi lại số tiền đã chuyển khoản cho khách.", kind: "primary" },
  reject: { to: "rejected", label: "Từ chối", body: "Không cộng tồn kho. Lý do sẽ hiện cho khách khi tra cứu đơn; nếu hàng đã về, gửi trả lại khách.", kind: "destructive" },
  cancel: { to: "cancelled", label: "Hủy yêu cầu", body: "Dùng khi khách không muốn trả nữa. Không cộng tồn kho.", kind: "ghost" },
};

// The next steps of a return (DASHBOARD_DESIGN.md §6.2b). Each step opens a small inline form in the
// card (confirmation + the field it needs), then calls transition_return() through moveReturn().
export function ReturnActions({ returnId, status, suggestedRefund }: { returnId: string; status: ReturnStatus; suggestedRefund: number }) {
  const [step, setStep] = useState<ReturnStep | null>(null);
  const [note, setNote] = useState("");
  const [tracking, setTracking] = useState("");
  const [amount, setAmount] = useState(String(suggestedRefund));
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [pending, startTransition] = useTransition();
  const steps = RETURN_STEPS[status];

  // Finished requests still render the toast: the last step (refund, reject, cancel) lands here.
  if (!steps.length) {
    return (
      <>
        <p className="text-text-secondary">Yêu cầu đã kết thúc, không còn thao tác nào.</p>
        <Toast toast={toast} setToast={setToast} />
      </>
    );
  }

  function open(s: ReturnStep) {
    setStep(s);
    setError(null);
  }

  function confirm() {
    if (!step) return;
    const a = STEP[step];
    const value = Number(amount.replace(/\D/g, ""));
    if (step === "refund" && (!amount.trim() || !Number.isFinite(value))) return setError("Nhập số tiền đã hoàn.");
    startTransition(async () => {
      const res = await moveReturn(returnId, a.to, { note, tracking, amount: step === "refund" ? value : undefined });
      startTransition(() => {
        if (res.error) return setError(res.error);
        setStep(null);
        setNote("");
        setToast({ ok: true, text: res.ok ?? a.label });
      });
    });
  }

  const a = step ? STEP[step] : null;
  return (
    <>
      {!a ? (
        <div className="flex flex-col gap-2">
          {steps.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => open(s)}
              className={STEP[s].kind === "primary" ? primaryClass : STEP[s].kind === "destructive" ? destructiveClass : ghostClass}
            >
              {STEP[s].label}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-sm border border-border p-4">
          <p className="text-card-title uppercase">{a.label}</p>
          <p className="text-text-secondary">{a.body}</p>
          {step === "pickup" && (
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Mã vận đơn SPX</span>
              <input value={tracking} onChange={(e) => setTracking(e.target.value)} maxLength={40} className={inputClass} />
            </label>
          )}
          {step === "refund" && (
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Số tiền đã hoàn (gợi ý {formatVnd(suggestedRefund)})</span>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" maxLength={12} className={inputClass} />
            </label>
          )}
          {(step === "reject" || step === "refund" || step === "cancel") && (
            <label className="flex flex-col gap-1">
              <span className={labelClass}>{step === "reject" ? "Lý do từ chối (khách sẽ thấy)" : step === "refund" ? "Ghi chú (ví dụ mã giao dịch)" : "Ghi chú"}</span>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} className={`${inputClass} h-auto py-2`} />
            </label>
          )}
          {error && <p role="alert" className="text-label text-accent">{error}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setStep(null)} disabled={pending} className={`${ghostClass} sm:w-auto`}>Quay lại</button>
            <button type="button" onClick={confirm} disabled={pending} className={`${a.kind === "destructive" ? destructiveClass : primaryClass} sm:w-auto`}>
              {pending ? "Đang lưu…" : "Xác nhận"}
            </button>
          </div>
        </div>
      )}
      <Toast toast={toast} setToast={setToast} />
    </>
  );
}
