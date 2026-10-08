"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@paranoidz/db/client";
import { afterLoginPath } from "@/lib/auth";
import { Field } from "./Field";
import { OAuthButtons } from "./OAuthButtons";
import { linkClass, primaryClass } from "./styles";

type Errors = { email?: string; password?: string; form?: string };

// Client-side supabase-js (ARCHITECTURE.md §2.2): the browser calls Supabase Auth directly,
// so its per-IP sign-in rate limit sees the customer's IP, not our server's.
// onSignedIn: used by the login modal — stay on the page instead of going through the phone step URL.
export function LoginForm({ next, notice, onSignedIn }: { next: string; notice?: string; onSignedIn?: () => void }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const errs: Errors = {};
    if (!email) errs.email = "Nhập email của bạn.";
    if (!password) errs.password = "Nhập mật khẩu.";
    setErrors(errs);
    if (errs.email || errs.password) {
      document.getElementById(errs.email ? "email" : "password")?.focus();
      return;
    }

    setPending(true);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (!error) return onSignedIn ? onSignedIn() : router.replace(afterLoginPath(next));
    setPending(false);
    setErrors({
      form:
        error.code === "invalid_credentials" ? "Email hoặc mật khẩu không đúng."
        : error.code === "email_not_confirmed" ? "Hãy xác nhận email trước: mở liên kết chúng tôi đã gửi, rồi đăng nhập."
        : error.status === 429 ? "Thử quá nhiều lần. Vui lòng đợi vài phút rồi thử lại."
        : "Không thể đăng nhập. Vui lòng thử lại.",
    });
  }

  const registerHref = next === "/account" ? "/register" : `/register?next=${encodeURIComponent(next)}`;

  return (
    <div className="flex max-w-md flex-col gap-6">
      {notice && <p role="status" className="rounded-sm bg-bg-secondary p-4 text-text-secondary">{notice}</p>}
      <form onSubmit={submit} noValidate className="flex flex-col gap-6">
        {/* In the modal the form mounts after showModal(), so the dialog can't pick the field itself. */}
        <Field id="email" label="Email" error={errors.email} type="email" autoComplete="email" maxLength={200} autoFocus={!!onSignedIn} />
        <div className="flex flex-col gap-2">
          <Field id="password" label="Mật khẩu" error={errors.password} type="password" autoComplete="current-password" maxLength={72} />
          <Link href="/forgot-password" className={`-mb-3 flex min-h-11 items-center self-end text-caption ${linkClass}`}>Quên mật khẩu?</Link>
        </div>
        {errors.form && <p role="alert" className="text-caption text-accent">{errors.form}</p>}
        <button type="submit" disabled={pending} className={primaryClass}>
          {pending ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>
      </form>
      <OAuthButtons next={next} />
      <p className="text-text-secondary">
        Chưa có tài khoản? <Link href={registerHref} className={linkClass}>Tạo tài khoản</Link>
      </p>
    </div>
  );
}
