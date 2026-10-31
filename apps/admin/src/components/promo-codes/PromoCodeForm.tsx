"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { savePromoCode, type PromoInput, type PromoType } from "@/app/(shell)/promo-codes/actions";
import { Toast, type ToastMessage } from "../Toast";

const input =
  "h-10 w-full rounded-sm border bg-surface px-3 text-base md:text-input focus:border-text-primary focus:shadow-[0_0_0_2px_var(--color-accent-soft)] focus:outline-none disabled:bg-bg-secondary disabled:text-text-secondary";

// Full-page create / edit (§6.7, no modal CRUD). `orderCount` = orders ever priced with
// the code (cancelled ones too): once > 0, code / % / cap are fixed; active, max uses and
// expiry stay editable. `usedCount` = uses currently counted against max uses.
export function PromoCodeForm({ initial, orderCount = 0, usedCount = 0 }: { initial: PromoInput; orderCount?: number; usedCount?: number }) {
  const locked = orderCount > 0;
  const router = useRouter();
  const creating = !initial.id;
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof PromoInput>(key: K, value: PromoInput[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== key)));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await savePromoCode(values);
      startTransition(() => {
        setErrors(res.errors ?? {});
        if (res.errors) return;
        if (creating) router.push("/promo-codes");
        else setToast({ ok: true, text: "Đã lưu mã giảm giá" });
      });
    });
  }

  const field = (key: "code" | "discountPct" | "capAmount" | "maxUses" | "expiresOn", label: string, hint: string, props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className="flex flex-col gap-2">
      <label htmlFor={key} className="text-label uppercase">{label}</label>
      <input
        id={key} value={values[key]} onChange={(e) => set(key, e.target.value)}
        aria-invalid={!!errors[key]} aria-describedby={`${key}-hint${errors[key] ? ` ${key}-error` : ""}`}
        className={`${input} ${errors[key] ? "border-accent" : "border-border"}`}
        {...props}
      />
      <p id={`${key}-hint`} className="text-stat-label text-text-secondary">{hint}</p>
      {errors[key] && <p id={`${key}-error`} className="text-stat-label text-accent">{errors[key]}</p>}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      {errors.form && <p role="alert" className="rounded-sm border border-accent bg-surface p-4 text-accent">{errors.form}</p>}

      <section className="flex flex-col gap-5 rounded-sm border border-border bg-surface p-5">
        <h2 className="text-card-title uppercase">Thông tin mã</h2>
        {locked && (
          <p className="rounded-sm bg-bg-secondary p-4 text-text-secondary">
            Mã đã được dùng cho {orderCount} đơn hàng nên không đổi được loại mã, mã, % giảm và mức giảm tối đa. Vẫn có thể bật / tắt, hiện trong danh sách, đổi số lượt và ngày hết hạn.
          </p>
        )}
        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-2 md:col-span-2">
            <label htmlFor="type" className="text-label uppercase">Loại mã</label>
            <select
              id="type" value={values.type} disabled={locked} onChange={(e) => set("type", e.target.value as PromoType)}
              aria-describedby="type-hint" className={`${input} border-border md:max-w-sm`}
            >
              <option value="promo">Mỗi số điện thoại dùng 1 lần</option>
              <option value="standing">Dùng mọi đơn</option>
            </select>
            <p id="type-hint" className="text-stat-label text-text-secondary">
              &quot;Dùng mọi đơn&quot;: không giới hạn theo số điện thoại (ví dụ mã Khách mua lần đầu). Loại này và danh sách chọn mã chỉ có hiệu lực ở trang thanh toán sau bản cập nhật cộng dồn mã.
            </p>
          </div>
          {field("code", "Mã", "Khách nhập mã này khi đặt hàng (không phân biệt hoa thường).", {
            maxLength: 30, disabled: locked, autoCapitalize: "characters", spellCheck: false,
            onChange: (e) => set("code", e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "")),
            className: `${input} uppercase ${errors.code ? "border-accent" : "border-border"}`,
          })}
          {field("discountPct", "Giảm (%)", "Từ 1 đến 100.", { inputMode: "numeric", maxLength: 3, disabled: locked })}
          {field("capAmount", "Giảm tối đa (₫)", "Để trống = không giới hạn.", { inputMode: "numeric", maxLength: 9, disabled: locked, placeholder: "Không giới hạn" })}
          {field("maxUses", "Tổng số lượt dùng", `Để trống = không giới hạn.${usedCount ? ` Đã dùng ${usedCount}.` : ""} Đơn bị hủy trả lại lượt.`, { inputMode: "numeric", maxLength: 7, placeholder: "Không giới hạn" })}
          {field("expiresOn", "Ngày hết hạn", "Dùng được đến hết ngày này (giờ Việt Nam). Để trống = không hết hạn.", { type: "date" })}
          <label className="flex h-10 items-center gap-3 md:self-start md:mt-6">
            <input type="checkbox" checked={values.isActive} onChange={(e) => set("isActive", e.target.checked)} className="size-5 accent-text-primary" />
            Đang bật — khách dùng được mã
          </label>
          <label className="flex min-h-10 items-center gap-3 md:col-span-2">
            <input type="checkbox" checked={values.isListed} onChange={(e) => set("isListed", e.target.checked)} className="size-5 accent-text-primary" />
            Hiện trong danh sách chọn mã ở trang thanh toán (bỏ tích: khách phải tự nhập mã)
          </label>
        </div>
      </section>

      <div className="sticky bottom-0 -mx-6 -mb-6 flex justify-end gap-2 border-t border-border bg-surface px-6 py-3">
        <Link href="/promo-codes" className="flex h-10 items-center px-4 text-button uppercase text-text-secondary hover:text-text-primary">Hủy</Link>
        <button
          type="submit" disabled={pending}
          className="h-10 rounded-sm bg-accent px-6 text-button uppercase text-text-on-dark transition-colors duration-200 enabled:hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Đang lưu…" : creating ? "Tạo mã" : "Lưu"}
        </button>
      </div>
      <Toast toast={toast} setToast={setToast} />
    </form>
  );
}
