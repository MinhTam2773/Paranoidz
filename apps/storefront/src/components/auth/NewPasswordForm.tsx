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
      setError(`Use at least ${PASSWORD_MIN} characters.`);
      return document.getElementById("password")?.focus();
    }
    setPending(true);
    const { error } = await createClient().auth.updateUser({ password });
    setPending(false);
    if (!error) return setDone(true);
    setError(
      error.code === "same_password" ? "Choose a password different from your current one."
      : error.code === "weak_password" ? "That password is too easy to guess. Try a longer one."
      : error.code === "reauthentication_needed" ? "For security, log out and back in, then change your password."
      : "Couldn't change your password. Try again.",
    );
  }

  if (done) {
    return (
      <p role="status" className="max-w-md text-text-secondary">
        Password changed. <Link href="/account" className={linkClass}>Back to your account</Link>
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex max-w-md flex-col gap-6">
      <Field
        id="password"
        label="New password"
        error={error}
        type="password"
        autoComplete="new-password"
        maxLength={72}
        placeholder={`At least ${PASSWORD_MIN} characters`}
      />
      <button type="submit" disabled={pending} className={primaryClass}>
        {pending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
