"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createClient } from "@paranoidz/db/client";
import { PASSWORD_MIN } from "@/lib/auth";
import { Field } from "./Field";
import { linkClass, primaryClass } from "./styles";

export function NewPasswordForm() {
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    if (password.length < PASSWORD_MIN) {
      setError(`Dùng ít nhất ${PASSWORD_MIN} ký tự.`);
      return document.getElementById("password")?.focus();
    }
    setPending(true);
    const { error } = await createClient().auth.updateUser({ password });
    setPending(false);
    if (!error) return setDone(true);
    setError(
      error.code === "same_password" ? "Hãy chọn mật khẩu khác với mật khẩu hiện tại."
      : error.code === "weak_password" ? "Mật khẩu này quá dễ đoán. Hãy dùng mật khẩu dài hơn."
      : error.code === "reauthentication_needed" ? "Để bảo mật, hãy đăng xuất và đăng nhập lại, rồi đổi mật khẩu."
      : "Không thể đổi mật khẩu. Vui lòng thử lại.",
    );
  }

  if (done) {
    return (
      <p role="status" className="max-w-md text-text-secondary">
        Đã đổi mật khẩu. <Link href="/account" className={linkClass}>Quay lại tài khoản</Link>
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex max-w-md flex-col gap-6">
      <Field
        id="password"
        label="Mật khẩu mới"
        error={error}
        type="password"
        autoComplete="new-password"
        maxLength={72}
        placeholder={`Ít nhất ${PASSWORD_MIN} ký tự`}
      />
      <button type="submit" disabled={pending} className={primaryClass}>
        {pending ? "Đang lưu…" : "Đổi mật khẩu"}
      </button>
    </form>
  );
}
