"use client";

import { useState, useTransition, type FormEvent } from "react";
import { updateProfile } from "@/app/account/actions";
import { Field } from "@/components/auth/Field";
import { errorClass, primaryClass, secondaryClass } from "@/components/auth/styles";
import { formatPhone, type FieldErrors } from "@/lib/checkout-validation";

// Account overview (Stitch "User Profile" card) with EDIT PROFILE: name + phone only.
// Email isn't editable here — changing it needs confirmation emails (TODO.md, SMTP).
export function ProfileCard({ name, email, phone }: { name: string; email: string; phone: string }) {
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setMessage(undefined);
    startTransition(async () => {
      const res = await updateProfile({ name: String(form.get("profile-name") ?? ""), phone: String(form.get("profile-phone") ?? "") });
      // Updates after an await leave the transition unless wrapped again (React): without this the
      // card closes first and shows the old values until the revalidated page arrives.
      if (res.ok) {
        return startTransition(() => {
          setErrors({});
          setEditing(false);
        });
      }
      setErrors(res.fieldErrors ?? {});
      setMessage(res.message);
      document.getElementById(res.fieldErrors?.name ? "profile-name" : "profile-phone")?.focus();
    });
  }

  if (editing) {
    return (
      <form onSubmit={submit} noValidate className="flex flex-col gap-5 rounded-sm border border-text-primary p-6">
        <h2 className="text-nav uppercase">Edit profile</h2>
        <Field id="profile-name" label="Full name" error={errors.name} defaultValue={name} autoComplete="name" maxLength={100} autoFocus />
        <Field
          id="profile-phone"
          label="Phone number"
          error={errors.phone}
          defaultValue={formatPhone(phone)}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0901 234 567"
          maxLength={15}
        />
        <p className="text-caption text-text-muted">Your email can&apos;t be changed here.</p>
        {message && <p role="alert" className={errorClass}>{message}</p>}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="submit" disabled={pending} className={`${primaryClass} sm:flex-1`}>{pending ? "Saving…" : "Save"}</button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setErrors({});
              setEditing(false);
            }}
            className={`${secondaryClass} sm:flex-1`}
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  const rows = [
    { label: "Name", value: name || "—" },
    { label: "Email", value: email || "—" },
    { label: "Phone", value: formatPhone(phone) },
  ];
  return (
    <div className="flex flex-col gap-5 rounded-sm border border-border p-6">
      <dl className="flex flex-col gap-4">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex flex-col gap-1">
            <dt className="text-nav uppercase text-text-secondary">{label}</dt>
            <dd className="wrap-break-word">{value}</dd>
          </div>
        ))}
      </dl>
      <button type="button" onClick={() => setEditing(true)} className={secondaryClass}>Edit profile</button>
    </div>
  );
}
