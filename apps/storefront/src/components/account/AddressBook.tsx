"use client";

import { useState, useTransition, type FormEvent } from "react";
import { deleteAddress, saveAddress, setDefaultAddress, type AddressFields } from "@/app/account/actions";
import { Field } from "@/components/auth/Field";
import { errorClass, labelClass, primaryClass, secondaryClass } from "@/components/auth/styles";
import { ProvinceSelect } from "@/components/checkout/ProvinceSelect";
import { formatPhone, type FieldErrors } from "@/lib/checkout-validation";

export type SavedAddress = AddressFields & { id: string; isDefault: boolean };

const actionClass = "flex min-h-11 items-center text-nav uppercase disabled:opacity-50";

// Delivery addresses (Stitch "User Profile" cards). One form open at a time: "new" or an address id.
export function AddressBook({ addresses }: { addresses: SavedAddress[] }) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <section aria-labelledby="addresses" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 id="addresses" className="text-h3 uppercase">Delivery addresses</h2>
        {editing === null && addresses.length < 10 && (
          <button type="button" onClick={() => setEditing("new")} className={`${actionClass} text-text-primary underline underline-offset-4 hover:text-accent`}>
            Add new
          </button>
        )}
      </div>
      {editing === "new" && <AddressForm onDone={() => setEditing(null)} />}
      {addresses.length === 0 && editing !== "new" && (
        <p className="text-text-secondary">No saved addresses yet. Save one to fill in checkout faster.</p>
      )}
      <ul className="grid gap-4 lg:grid-cols-2">
        {addresses.map((a) =>
          editing === a.id ? (
            <li key={a.id} className="lg:col-span-2"><AddressForm initial={a} onDone={() => setEditing(null)} /></li>
          ) : (
            <AddressCard key={a.id} address={a} canEdit={editing === null} onEdit={() => setEditing(a.id)} />
          ),
        )}
      </ul>
    </section>
  );
}

function AddressCard({ address: a, canEdit, onEdit }: { address: SavedAddress; canEdit: boolean; onEdit: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    setError(undefined);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) setError(res.message ?? "Couldn't update that. Try again.");
    });
  }

  return (
    <li className={`flex flex-col gap-3 rounded-sm border p-5 ${a.isDefault ? "border-text-primary" : "border-border"}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="wrap-break-word text-product-name font-bold">{a.name}</span>
        {a.isDefault && <span className="shrink-0 rounded-sm border border-text-primary px-2 py-0.5 text-caption uppercase">Default</span>}
      </div>
      <div className="flex flex-col gap-1 text-text-secondary">
        <span>{formatPhone(a.phone)}</span>
        <span className="wrap-break-word">{[a.address, a.ward, a.city].join(", ")}</span>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-x-5 border-t border-border pt-2">
        {confirming ? (
          <>
            <span className="text-caption text-text-secondary">Delete this address?</span>
            <button type="button" disabled={pending} onClick={() => run(() => deleteAddress(a.id))} className={`${actionClass} text-accent`}>
              {pending ? "Deleting…" : "Delete"}
            </button>
            <button type="button" disabled={pending} onClick={() => setConfirming(false)} className={`${actionClass} text-text-secondary`}>
              Keep
            </button>
          </>
        ) : (
          <>
            <button type="button" disabled={!canEdit || pending} onClick={onEdit} className={`${actionClass} text-text-primary`}>Edit</button>
            <button type="button" disabled={!canEdit || pending} onClick={() => setConfirming(true)} className={`${actionClass} text-text-secondary`}>
              Delete
            </button>
            {!a.isDefault && (
              <button
                type="button"
                disabled={!canEdit || pending}
                onClick={() => run(() => setDefaultAddress(a.id))}
                className={`${actionClass} ml-auto text-text-primary underline underline-offset-4`}
              >
                Set default
              </button>
            )}
          </>
        )}
      </div>
      {error && <p role="alert" className={errorClass}>{error}</p>}
    </li>
  );
}

function AddressForm({ initial, onDone }: { initial?: SavedAddress; onDone: () => void }) {
  const [city, setCity] = useState(initial?.city ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const get = (k: string) => String(form.get(k) ?? "");
    const values: AddressFields = { name: get("addr-name"), phone: get("addr-phone"), address: get("addr-address"), ward: get("addr-ward"), city };
    setMessage(undefined);
    startTransition(async () => {
      const res = await saveAddress({ id: initial?.id, ...values });
      if (res.ok) return onDone();
      setErrors(res.fieldErrors ?? {});
      setMessage(res.message);
      const first = (["name", "phone", "address", "ward", "city"] as const).find((k) => res.fieldErrors?.[k]);
      if (first) document.getElementById(`addr-${first}`)?.focus();
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5 rounded-sm border border-text-primary p-5">
      <h3 className="text-nav uppercase">{initial ? "Edit address" : "New address"}</h3>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="addr-name" label="Full name" error={errors.name} defaultValue={initial?.name} autoComplete="name" maxLength={100} />
        <Field
          id="addr-phone"
          label="Phone number"
          error={errors.phone}
          defaultValue={initial ? formatPhone(initial.phone) : undefined}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0901 234 567"
          maxLength={15}
        />
        <div className="sm:col-span-2">
          <Field
            id="addr-address"
            label="Street address"
            error={errors.address}
            defaultValue={initial?.address}
            autoComplete="street-address"
            placeholder="House number, street"
            maxLength={200}
          />
        </div>
        <Field id="addr-ward" label="Ward / commune" error={errors.ward} defaultValue={initial?.ward} placeholder="e.g. Phường Bến Thành" maxLength={100} />
        <div className="flex flex-col gap-2">
          <label htmlFor="addr-city" className={labelClass}>City / province</label>
          <ProvinceSelect
            id="addr-city"
            name="addr-city"
            value={city}
            onChange={setCity}
            invalid={!!errors.city}
            describedBy={errors.city ? "addr-city-error" : undefined}
          />
          {errors.city && <p id="addr-city-error" className={errorClass}>{errors.city}</p>}
        </div>
      </div>
      {message && <p role="alert" className={errorClass}>{message}</p>}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="submit" disabled={pending} className={`${primaryClass} sm:w-48`}>{pending ? "Saving…" : "Save address"}</button>
        <button type="button" disabled={pending} onClick={onDone} className={`${secondaryClass} sm:w-48`}>Cancel</button>
      </div>
    </form>
  );
}
