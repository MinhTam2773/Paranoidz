"use client";

import { useState, useTransition, type FormEvent } from "react";
import { endFreeShipCampaign, saveFreeShipCampaign } from "@/app/(shell)/promo-codes/actions";
import { Toast, type ToastMessage } from "../Toast";

const input =
  "h-10 w-full rounded-sm border bg-surface px-3 text-base md:text-input focus:border-text-primary focus:shadow-[0_0_0_2px_var(--color-accent-soft)] focus:outline-none";

// Free shipping on every standard-delivery order between two Vietnam date-times.
// `startsAt` / `endsAt`: "yyyy-mm-ddThh:mm" (Vietnam time) or "" when there is no campaign;
// `status`: the line the page computed ("Đang chạy đến …", …), null when there is none.
export function FreeShipCampaignCard({ startsAt, endsAt, status }: { startsAt: string; endsAt: string; status: string | null }) {
  const [values, setValues] = useState({ startsAt, endsAt });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveFreeShipCampaign(values.startsAt, values.endsAt);
      setErrors(res.errors ?? {});
      if (!res.errors) setToast({ ok: true, text: "Đã lưu chương trình freeship" });
    });
  }

  function end() {
    startTransition(async () => {
      const res = await endFreeShipCampaign();
      if (res.error) return setToast({ ok: false, text: res.error });
      setValues({ startsAt: "", endsAt: "" });
      setErrors({});
      setToast({ ok: true, text: "Đã tắt chương trình freeship" });
    });
  }

  const field = (key: "startsAt" | "endsAt", label: string) => (
    <div className="flex flex-col gap-2">
      <label htmlFor={key} className="text-label uppercase">{label}</label>
      <input
        id={key} type="datetime-local" value={values[key]}
        onChange={(e) => { const v = e.target.value; setValues((s) => ({ ...s, [key]: v })); }}
        aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `${key}-error` : undefined}
        className={`${input} ${errors[key] ? "border-accent" : "border-border"}`}
      />
      {errors[key] && <p id={`${key}-error`} className="text-stat-label text-accent">{errors[key]}</p>}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-sm border border-border bg-surface p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-card-title uppercase">Freeship mọi đơn</h2>
        <p className="text-text-secondary">
          Trong khoảng thời gian này (giờ Việt Nam), mọi đơn giao thường được miễn phí vận chuyển, không cần đủ ₫199.000. Đơn hoả tốc vẫn tính phí.
        </p>
        <p className="font-semibold">{status ?? "Chưa có chương trình."}</p>
      </div>
      {errors.form && <p role="alert" className="text-accent">{errors.form}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {field("startsAt", "Bắt đầu")}
        {field("endsAt", "Kết thúc")}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {status && (
          <button type="button" onClick={end} disabled={pending} className="h-10 px-4 text-button uppercase text-text-secondary hover:text-text-primary disabled:opacity-50">
            Tắt chương trình
          </button>
        )}
        <button
          type="submit" disabled={pending}
          className="h-10 rounded-sm bg-accent px-6 text-button uppercase text-text-on-dark transition-colors duration-200 enabled:hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Đang lưu…" : "Lưu"}
        </button>
      </div>
      <Toast toast={toast} setToast={setToast} />
    </form>
  );
}
