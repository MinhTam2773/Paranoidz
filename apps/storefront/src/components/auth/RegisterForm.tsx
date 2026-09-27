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
  if (v.fullName.trim().length < 2) errs.fullName = "Enter your full name.";
  if (!normalizePhone(v.phone)) errs.phone = "Enter a Vietnamese mobile number: 10 digits starting with 03, 05, 07, 08 or 09.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email.trim())) errs.email = "Enter a valid email, e.g. name@gmail.com.";
  if (v.password.length < PASSWORD_MIN) errs.password = `Use at least ${PASSWORD_MIN} characters.`;
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
      if (error.code === "weak_password") return setErrors({ password: "That password is too easy to guess. Try a longer one." });
      if (error.code === "email_address_invalid")
        return setErrors({ email: "This address can't receive email. Check it for typos, or use another one." });
      if (error.code === "user_already_exists" || error.code === "email_exists")
        return setErrors({ email: "This email already has an account. Log in instead." });
      // Project-wide cap on auth emails, not this visitor's fault.
      if (error.code === "over_email_send_rate_limit")
        return setErrors({ form: "We can't send sign-up emails right now. Try again in an hour, or order as a guest meanwhile." });
      if (error.status === 429) return setErrors({ form: "Too many attempts. Wait a few minutes and try again." });
      return setErrors({ form: "Couldn't create your account. Try again." });
    }
    // Email confirmation on → no session yet. Also the answer for an already-registered email,
    // so the form can't be used to find out who has an account.
    if (!data.session) return setSentTo(email);
    router.replace(afterLoginPath(next));
  }

  if (sentTo) {
    return (
      <div role="status" className="flex max-w-md flex-col gap-4">
        <h2 className="text-h3 uppercase">Check your email</h2>
        <p className="text-text-secondary">
          We sent a link to <strong className="wrap-break-word text-text-primary">{sentTo}</strong>. Open it to finish creating your account.
        </p>
        <p className="text-caption text-text-muted">No email after a few minutes? Check your spam folder, or try again.</p>
      </div>
    );
  }

  const loginHref = next === "/account" ? "/login" : `/login?next=${encodeURIComponent(next)}`;

  return (
    <div className="flex max-w-md flex-col gap-6">
      <form onSubmit={submit} noValidate className="flex flex-col gap-6">
        <Field id="fullName" label="Full name" error={errors.fullName} autoComplete="name" maxLength={100} />
        <Field
          id="phone"
          label="Phone number"
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
          label="Password"
          error={errors.password}
          type="password"
          autoComplete="new-password"
          maxLength={72}
          placeholder={`At least ${PASSWORD_MIN} characters`}
        />
        {errors.form && <p role="alert" className="text-caption text-accent">{errors.form}</p>}
        <button type="submit" disabled={pending} className={primaryClass}>
          {pending ? "Creating account…" : "Create account"}
        </button>
      </form>
      <OAuthButtons next={next} />
      <p className="text-text-secondary">
        Already have an account? <Link href={loginHref} className={linkClass}>Log in</Link>
      </p>
    </div>
  );
}
