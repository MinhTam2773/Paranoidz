"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@paranoidz/db/client";
import { Field } from "./Field";
import { primaryClass } from "./styles";

export function ForgotPasswordForm() {
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string>();

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setError("Nhập email bạn đã dùng để đăng ký.");
      return document.getElementById("email")?.focus();
    }
    setPending(true);
    // The link opens /auth/confirm, whose button signs them in and lands on the new-password form.
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/confirm?next=${encodeURIComponent("/account/password")}`,
    });
    setPending(false);
    if (error?.code === "over_email_send_rate_limit") return setError("Hiện chưa thể gửi email. Vui lòng thử lại sau một giờ.");
    if (error?.status === 429) return setError("Quá nhiều yêu cầu. Vui lòng đợi vài phút rồi thử lại.");
    if (error) return setError("Không thể gửi email. Vui lòng thử lại.");
    setSentTo(email);
  }

  if (sentTo) {
    // Same answer whether or not the email has an account.
    return (
      <p role="status" className="max-w-md text-text-secondary">
        Nếu <strong className="wrap-break-word text-text-primary">{sentTo}</strong> có tài khoản Paranoidz, chúng tôi đã gửi liên kết
        để đặt mật khẩu mới. Hãy mở liên kết trên trình duyệt này.
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex max-w-md flex-col gap-6">
      <Field id="email" label="Email" error={error} type="email" autoComplete="email" maxLength={200} />
      <button type="submit" disabled={pending} className={primaryClass}>
        {pending ? "Đang gửi…" : "Gửi liên kết đặt lại"}
      </button>
    </form>
  );
}
