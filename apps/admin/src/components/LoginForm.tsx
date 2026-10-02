"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@paranoidz/db/client";

// DASHBOARD_DESIGN.md §5 forms; 16px inputs below md so iOS Safari doesn't zoom on focus.
const inputClass =
  "h-10 w-full rounded-sm border bg-surface px-3 text-base md:text-input focus:border-text-primary focus:shadow-[0_0_0_2px_var(--color-accent-soft)] focus:outline-none";

type Errors = { email?: string; password?: string; form?: string };

// Signs in from the browser (same as the storefront). Whether the account is an
// admin is decided by the proxy gate on the next request, never here.
export function LoginForm({ notice }: { notice?: string }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const errs: Errors = {};
    if (!email) errs.email = "Nhập email.";
    if (!password) errs.password = "Nhập mật khẩu.";
    setErrors(errs);
    if (errs.email || errs.password) return;

    setPending(true);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (!error) {
      router.replace("/");
      router.refresh();
      return;
    }
    setPending(false);
    setErrors({
      form:
        error.code === "invalid_credentials" ? "Email hoặc mật khẩu không đúng."
        : error.code === "email_not_confirmed" ? "Email chưa được xác nhận."
        : error.status === 429 ? "Thử quá nhiều lần. Vui lòng đợi vài phút rồi thử lại."
        : "Không thể đăng nhập. Vui lòng thử lại.",
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {notice && !errors.form && <p role="alert" className="rounded-sm bg-bg-secondary p-3 text-text-secondary">{notice}</p>}
      <Field id="email" label="Email" error={errors.email} type="email" autoComplete="email" maxLength={200} autoFocus />
      <Field id="password" label="Mật khẩu" error={errors.password} type="password" autoComplete="current-password" maxLength={72} />
      {errors.form && <p role="alert" className="text-stat-label text-accent">{errors.form}</p>}
      <button
        type="submit"
        disabled={pending}
        className="h-10 w-full rounded-sm bg-accent text-button uppercase text-text-on-dark transition-colors duration-200 enabled:hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-bg-tertiary disabled:text-text-muted"
      >
        {pending ? "Đang đăng nhập…" : "Đăng nhập"}
      </button>
    </form>
  );
}

function Field({ id, label, error, ...input }: { id: string; label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-label uppercase">{label}</label>
      <input
        id={id}
        name={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${inputClass} ${error ? "border-accent" : "border-border"}`}
        {...input}
      />
      {error && <p id={`${id}-error`} className="text-stat-label text-accent">{error}</p>}
    </div>
  );
}
