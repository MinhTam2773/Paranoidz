"use client";

import { useFormStatus } from "react-dom";
import { primaryClass } from "./styles";

// Disabled while the token is being spent: a second submit would find it used and land on the
// "link expired" notice after the first had already signed the visitor in.
export function ConfirmButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={primaryClass}>
      {pending ? "Đang xác nhận…" : label}
    </button>
  );
}
