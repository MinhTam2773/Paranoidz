"use client";

import { useState, useTransition, type FormEvent } from "react";
import { savePhone } from "@/app/account/phone/actions";
import { normalizePhone } from "@/lib/checkout-validation";
import { Field } from "./Field";
import { primaryClass } from "./styles";

export function PhoneForm({ next }: { next: string }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const phone = String(new FormData(e.currentTarget).get("phone") ?? "");
    if (!normalizePhone(phone)) {
      setError("Nhập số di động Việt Nam: 10 chữ số, bắt đầu bằng 03, 05, 07, 08 hoặc 09.");
      return document.getElementById("phone")?.focus();
    }
    startTransition(async () => {
      const res = await savePhone({ phone, next });
      if (res?.error) setError(res.error);
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex max-w-md flex-col gap-6">
      <Field
        id="phone"
        label="Số điện thoại"
        error={error}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="0901 234 567"
        maxLength={15}
        autoFocus
      />
      <button type="submit" disabled={pending} className={primaryClass}>
        {pending ? "Đang lưu…" : "Lưu và tiếp tục"}
      </button>
    </form>
  );
}
