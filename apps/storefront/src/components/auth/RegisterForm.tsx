"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@paranoidz/db/client";
import { afterLoginPath, PASSWORD_MIN } from "@/lib/auth";
import { normalizePhone } from "@/lib/checkout-validation";
import { Field } from "./Field";
import { OAuthButtons } from "./OAuthButtons";
import { linkClass, primaryClass } from "./styles";

type FieldName = "fullName" | "phone" | "email" | "password";
type Errors = Partial<Record<FieldName | "form", string>>;

function validate(v: Record<FieldName, string>): Errors {
  const errs: Errors = {};
  if (v.fullName.trim().length < 2) errs.fullName = "Nhập họ tên của bạn.";
  if (!normalizePhone(v.phone)) errs.phone = "Nhập số di động Việt Nam: 10 chữ số, bắt đầu bằng 03, 05, 07, 08 hoặc 09.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email.trim())) errs.email = "Nhập email hợp lệ, ví dụ ten@gmail.com.";
  if (v.password.length < PASSWORD_MIN) errs.password = `Dùng ít nhất ${PASSWORD_MIN} ký tự.`;
  return errs;
}

// The phone rides along as signup metadata; handle_new_user() stores it normalized, or leaves it
// empty if another account has it — the phone step after login then asks again and says why.
export function RegisterForm({ next }: { next: string }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string>();

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const v = Object.fromEntries(
      (["fullName", "phone", "email", "password"] as const).map((k) => [k, String(form.get(k) ?? "")]),
    ) as Record<FieldName, string>;
    const errs = validate(v);
    setErrors(errs);
    const first = (["fullName", "phone", "email", "password"] as const).find((k) => errs[k]);
    if (first) return document.getElementById(first)?.focus();

    setPending(true);
    const email = v.email.trim();
    const { data, error } = await createClient().auth.signUp({
      email,
      password: v.password,
      options: {
        data: { full_name: v.fullName.trim(), phone: normalizePhone(v.phone) },
        emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setPending(false);
    if (error) {
      if (error.code === "weak_password") return setErrors({ password: "Mật khẩu này quá dễ đoán. Hãy dùng mật khẩu dài hơn." });
      if (error.code === "email_address_invalid")
        return setErrors({ email: "Địa chỉ này không nhận được email. Hãy kiểm tra lỗi chính tả hoặc dùng email khác." });
      if (error.code === "user_already_exists" || error.code === "email_exists")
        return setErrors({ email: "Email này đã có tài khoản. Hãy đăng nhập." });
      // Project-wide cap on auth emails, not this visitor's fault.
      if (error.code === "over_email_send_rate_limit")
        return setErrors({ form: "Hiện chưa thể gửi email đăng ký. Vui lòng thử lại sau một giờ, trong lúc đó bạn vẫn có thể đặt hàng không cần tài khoản." });
      if (error.status === 429) return setErrors({ form: "Thử quá nhiều lần. Vui lòng đợi vài phút rồi thử lại." });
      return setErrors({ form: "Không thể tạo tài khoản. Vui lòng thử lại." });
    }
    // Email confirmation on → no session yet. Also the answer for an already-registered email,
    // so the form can't be used to find out who has an account.
    if (!data.session) return setSentTo(email);
    router.replace(afterLoginPath(next));
  }

  if (sentTo) {
    return (
      <div role="status" className="flex max-w-md flex-col gap-4">
        <h2 className="text-h3 uppercase">Kiểm tra email của bạn</h2>
        <p className="text-text-secondary">
          Chúng tôi đã gửi liên kết đến <strong className="wrap-break-word text-text-primary">{sentTo}</strong>. Hãy mở liên kết để hoàn tất tạo tài khoản.
        </p>
        <p className="text-caption text-text-muted">Chưa nhận được email sau vài phút? Hãy kiểm tra thư mục spam, hoặc thử lại.</p>
      </div>
    );
  }

  const loginHref = next === "/account" ? "/login" : `/login?next=${encodeURIComponent(next)}`;

  return (
    <div className="flex max-w-md flex-col gap-6">
      <form onSubmit={submit} noValidate className="flex flex-col gap-6">
        <Field id="fullName" label="Họ tên" error={errors.fullName} autoComplete="name" maxLength={64} />
        <Field
          id="phone"
          label="Số điện thoại"
          error={errors.phone}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0901 234 567"
          maxLength={15}
        />
        <Field id="email" label="Email" error={errors.email} type="email" autoComplete="email" maxLength={200} />
        <Field
          id="password"
          label="Mật khẩu"
          error={errors.password}
          type="password"
          autoComplete="new-password"
          maxLength={72}
          placeholder={`Ít nhất ${PASSWORD_MIN} ký tự`}
        />
        {errors.form && <p role="alert" className="text-caption text-accent">{errors.form}</p>}
        <button type="submit" disabled={pending} className={primaryClass}>
          {pending ? "Đang tạo tài khoản…" : "Tạo tài khoản"}
        </button>
      </form>
      <OAuthButtons next={next} />
      <p className="text-text-secondary">
        Đã có tài khoản? <Link href={loginHref} className={linkClass}>Đăng nhập</Link>
      </p>
    </div>
  );
}
