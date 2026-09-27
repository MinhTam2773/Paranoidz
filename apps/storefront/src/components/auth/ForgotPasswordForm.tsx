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
      setError("Enter the email you signed up with.");
      return document.getElementById("email")?.focus();
    }
    setPending(true);
    // The link signs them in (/auth/callback) and lands on the new-password form.
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent("/account/password")}`,
    });
    setPending(false);
    if (error?.code === "over_email_send_rate_limit") return setError("We can't send emails right now. Try again in an hour.");
    if (error?.status === 429) return setError("Too many requests. Wait a few minutes and try again.");
    if (error) return setError("Couldn't send the email. Try again.");
    setSentTo(email);
  }

  if (sentTo) {
    // Same answer whether or not the email has an account.
    return (
      <p role="status" className="max-w-md text-text-secondary">
        If <strong className="wrap-break-word text-text-primary">{sentTo}</strong> has a Paranoidz account, we&apos;ve sent it a link
        to choose a new password. Open it in this browser.
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex max-w-md flex-col gap-6">
      <Field id="email" label="Email" error={error} type="email" autoComplete="email" maxLength={200} />
      <button type="submit" disabled={pending} className={primaryClass}>
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
