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
      setError("Enter a Vietnamese mobile number: 10 digits starting with 03, 05, 07, 08 or 09.");
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
        label="Phone number"
        error={error}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="0901 234 567"
        maxLength={15}
        autoFocus
      />
      <button type="submit" disabled={pending} className={primaryClass}>
        {pending ? "Saving…" : "Save and continue"}
      </button>
    </form>
  );
}
