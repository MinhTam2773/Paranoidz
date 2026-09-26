"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type FocusEvent, type FormEvent, type ReactNode } from "react";
import { getCartItems, type CartItem } from "@/app/cart/actions";
import { placeOrder, type CheckoutResult } from "@/app/checkout/actions";
import { clearCart, useCart, type CartLine } from "@/lib/cart";
import {
  ALLOWED_CHARS,
  CHECKOUT_FIELDS,
  MAX_LENGTH,
  formatPhone,
  validateAll,
  validateField,
  type CheckoutField,
  type CheckoutValues,
  type FieldErrors,
} from "@/lib/checkout-validation";
import { formatVnd } from "@/lib/format";
import { ProvinceSelect } from "./ProvinceSelect";

type Placed = Extract<CheckoutResult, { ok: true }>["order"];

// 16px on mobile: iOS Safari zooms the page when focusing an input under 16px (DESIGN.md has no
// 16px text token; deliberate exception). Desktop keeps the 14px product-name size.
const inputClass =
  "w-full rounded-sm border bg-bg-primary px-3 text-base text-text-primary lg:text-product-name placeholder:text-text-muted focus:border-text-primary focus:shadow-[0_0_0_2px_var(--color-accent-soft)] focus:outline-none";
const secondaryClass =
  "flex h-12 w-full items-center justify-center rounded-sm border border-text-primary text-button uppercase text-text-primary transition-colors duration-200 hover:bg-text-primary hover:text-text-on-dark";

function Field({
  name,
  label,
  error,
  required,
  className = "",
  children,
}: {
  name: CheckoutField;
  label: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: (props: { id: string; name: string; "aria-invalid": boolean; "aria-describedby"?: string; className: string; required?: boolean }) => ReactNode;
}) {
  const id = `checkout-${name}`;
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label htmlFor={id} className="text-nav uppercase text-text-secondary">
        {label}
        {required ? <span className="text-accent"> *</span> : <span className="normal-case tracking-normal text-text-muted"> (optional)</span>}
      </label>
      {children({
        id,
        name,
        required,
        "aria-invalid": !!error,
        "aria-describedby": error ? `${id}-error` : undefined,
        className: `${inputClass} ${error ? "border-accent" : "border-border"}`,
      })}
      {error && (
        <p id={`${id}-error`} className="text-caption text-accent">
          {error}
        </p>
      )}
    </div>
  );
}

// COD checkout (ARCHITECTURE.md §4): delivery form + summary. Lines come from Buy It Now or the cart;
// the order itself is priced and validated server-side by placeOrder → place_order().
export function CheckoutView({ buyNow }: { buyNow: CartLine | null }) {
  const cart = useCart();
  const lines = buyNow ? [buyNow] : cart;
  const [items, setItems] = useState<Map<string, CartItem> | null>(null);
  const [message, setMessage] = useState<string | undefined>();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [city, setCity] = useState("");
  const [placed, setPlaced] = useState<Placed | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const idsKey = lines.map((l) => l.variantId).toSorted().join(",");

  useEffect(() => {
    let cancelled = false;
    (idsKey ? getCartItems(idsKey.split(",")) : Promise.resolve([])).then((res) => {
      if (!cancelled) setItems(new Map(res.map((i) => [i.variantId, i])));
    });
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  // FormData of the form includes the voucher (form="checkout-form") and the city's hidden input.
  function values(): CheckoutValues {
    const form = new FormData(formRef.current!);
    return Object.fromEntries(CHECKOUT_FIELDS.map((k) => [k, String(form.get(k) ?? "")])) as CheckoutValues;
  }

  function check(field: CheckoutField, value: string) {
    setErrors((e) => ({ ...e, [field]: validateField(field, value, values()) }));
  }

  function focusFirst(errs: FieldErrors) {
    const first = CHECKOUT_FIELDS.find((f) => errs[f]);
    if (first) document.getElementById(`checkout-${first}`)?.focus();
  }

  function fieldOf(target: EventTarget) {
    const el = target as HTMLInputElement;
    const field = el.name as CheckoutField;
    return (el.tagName === "INPUT" || el.tagName === "TEXTAREA") && CHECKOUT_FIELDS.includes(field) ? { el, field } : null;
  }

  // Live validation. Typing: strip characters the field can't hold, and once a field shows an
  // error re-check on every keystroke so it clears the moment it's fixed. Leaving a field: check
  // it if something was typed (empty required fields are reported on submit, not while tabbing).
  function onInput(e: FormEvent<HTMLDivElement>) {
    const f = fieldOf(e.target);
    if (!f) return;
    const strip = ALLOWED_CHARS[f.field];
    if (strip) {
      const clean = f.el.value.replace(strip, "");
      if (clean !== f.el.value) f.el.value = clean;
    }
    if (errors[f.field]) check(f.field, f.el.value);
  }

  function onBlur(e: FocusEvent<HTMLDivElement>) {
    const f = fieldOf(e.target);
    if (!f) return;
    if (f.field === "phone" || f.field === "secondaryPhone") f.el.value = formatPhone(f.el.value);
    if (f.el.value.trim() || errors[f.field]) check(f.field, f.el.value);
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = values();
    const errs = validateAll(v);
    setErrors(errs);
    setMessage(undefined);
    if (Object.keys(errs).length) return focusFirst(errs);
    startTransition(async () => {
      const res: CheckoutResult = await placeOrder({ items: lines.map((l) => ({ variantId: l.variantId, qty: l.qty })), ...v });
      if (res.ok) {
        setPlaced(res.order);
        if (!buyNow) clearCart();
        window.scrollTo({ top: 0 });
        return;
      }
      setErrors(res.fieldErrors ?? {});
      setMessage(res.message);
      if (res.fieldErrors) focusFirst(res.fieldErrors);
    });
  }

  if (placed) {
    return (
      <div role="status" className="flex max-w-xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-h3 uppercase">Thank you — order placed</h2>
          <p className="text-text-secondary">
            Your order number is <strong className="text-text-primary">{placed.orderNumber}</strong>. We&apos;ll call{" "}
            <strong className="text-text-primary">{placed.phone}</strong> to confirm it before shipping. You pay in cash on delivery.
          </p>
          <p className="text-text-secondary">
            Check its status anytime on{" "}
            <Link href={`/order-lookup?order=${placed.orderNumber}`} className="text-text-primary underline">order lookup</Link>{" "}
            with this order number and your phone.
          </p>
        </div>
        <dl className="flex flex-col gap-3 rounded-sm border border-border p-6">
          <div className="flex justify-between"><dt className="text-text-secondary">Subtotal</dt><dd>{formatVnd(placed.subtotal)}</dd></div>
          {placed.discount > 0 && (
            <div className="flex justify-between"><dt className="text-text-secondary">Discount</dt><dd className="text-accent">−{formatVnd(placed.discount)}</dd></div>
          )}
          <div className="flex justify-between border-t border-border pt-3">
            <dt className="text-nav uppercase">Total to pay on delivery</dt><dd className="text-price">{formatVnd(placed.total)}</dd>
          </div>
          <p className="text-caption text-text-muted">Shipping fee, if any, is confirmed on the call.</p>
        </dl>
        <Link href="/products" className={`${secondaryClass} max-w-xs`}>Continue shopping</Link>
      </div>
    );
  }

  if (!items) return <p className="text-text-secondary">Loading your order…</p>;

  if (!lines.length) {
    return (
      <div className="flex flex-col items-start gap-6">
        <p className="text-text-secondary">Your cart is empty.</p>
        <Link href="/products" className={`${secondaryClass} max-w-xs`}>Continue shopping</Link>
      </div>
    );
  }

  const rows = lines.map((line) => ({ line, item: items.get(line.variantId) }));
  const problem = rows.some(({ line, item }) => !item || line.qty > item.stock);
  const subtotal = rows.reduce((sum, { line, item }) => sum + (item ? item.price * line.qty : 0), 0);
  return (
    <div onInput={onInput} onBlur={onBlur} className="grid gap-8 lg:grid-cols-12 lg:gap-12">
      <form ref={formRef} id="checkout-form" onSubmit={submit} noValidate className="flex flex-col gap-6 lg:col-span-7">
        <h2 className="text-h3 uppercase">Delivery details</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field name="name" label="Full name" required error={errors.name}>
            {(p) => <input {...p} className={`${p.className} h-11`} autoComplete="name" maxLength={MAX_LENGTH.name} />}
          </Field>
          <Field name="phone" label="Phone number" required error={errors.phone}>
            {(p) => <input {...p} className={`${p.className} h-11`} type="tel" inputMode="tel" autoComplete="tel" placeholder="0901 234 567" maxLength={MAX_LENGTH.phone} />}
          </Field>
          <Field name="address" label="Street address" required error={errors.address} className="sm:col-span-2">
            {(p) => <input {...p} className={`${p.className} h-11`} autoComplete="street-address" placeholder="House number, street" maxLength={MAX_LENGTH.address} />}
          </Field>
          <Field name="ward" label="Ward / commune" required error={errors.ward}>
            {(p) => <input {...p} className={`${p.className} h-11`} autoComplete="address-level3" placeholder="e.g. Phường Bến Thành" maxLength={MAX_LENGTH.ward} />}
          </Field>
          <Field name="city" label="City / province" required error={errors.city}>
            {(p) => (
              <ProvinceSelect
                id={p.id}
                name={p.name}
                value={city}
                onChange={(v) => {
                  setCity(v);
                  check("city", v);
                }}
                invalid={p["aria-invalid"]}
                describedBy={p["aria-describedby"]}
              />
            )}
          </Field>
          <Field name="secondaryPhone" label="Secondary phone" error={errors.secondaryPhone}>
            {(p) => <input {...p} className={`${p.className} h-11`} type="tel" inputMode="tel" placeholder="Backup number" maxLength={MAX_LENGTH.secondaryPhone} />}
          </Field>
          <Field name="email" label="Email" error={errors.email}>
            {(p) => <input {...p} className={`${p.className} h-11`} type="email" autoComplete="email" placeholder="For your order confirmation" maxLength={MAX_LENGTH.email} />}
          </Field>
          <Field name="note" label="Order note" error={errors.note} className="sm:col-span-2">
            {(p) => <textarea {...p} className={`${p.className} py-3`} rows={3} placeholder="Delivery instructions" maxLength={MAX_LENGTH.note} />}
          </Field>
        </div>
      </form>

      <aside className="lg:col-span-5">
        <div className="flex flex-col gap-6 rounded-sm bg-bg-secondary p-6 lg:sticky lg:top-36">
          <h2 className="text-h3 uppercase">Order summary</h2>
          <ul className="flex flex-col gap-4">
            {rows.map(({ line, item }) => (
              <li key={line.variantId} className="flex gap-3">
                <div className="relative aspect-3/4 w-16 shrink-0 overflow-hidden rounded-sm bg-bg-tertiary">
                  {item?.imageUrl && <Image src={item.imageUrl} alt={item.name} fill sizes="64px" className="object-cover" />}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-product-name">{item?.name ?? "Unavailable item"}</span>
                  {item && <span className="text-caption uppercase text-text-secondary">{item.color} / {item.size} · Qty {line.qty}</span>}
                  {item && line.qty > item.stock && <span className="text-caption text-accent">Only {item.stock} left</span>}
                </div>
                {item && <span className="text-product-name">{formatVnd(item.price * line.qty)}</span>}
              </li>
            ))}
          </ul>

          <Field name="voucher" label="Voucher code" error={errors.voucher}>
            {(p) => <input {...p} form="checkout-form" className={`${p.className} h-11 uppercase`} autoComplete="off" maxLength={MAX_LENGTH.voucher} />}
          </Field>

          <dl className="flex flex-col gap-3 border-t border-border pt-4">
            <div className="flex justify-between"><dt className="text-text-secondary">Subtotal</dt><dd>{formatVnd(subtotal)}</dd></div>
            <div className="flex justify-between gap-4">
              <dt className="text-text-secondary">Discount</dt>
              <dd className="text-right text-caption text-text-secondary">Applied when you place the order</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-text-secondary">Shipping</dt>
              <dd className="text-right text-caption text-text-secondary">Confirmed on our call</dd>
            </div>
          </dl>
          <p className="text-caption text-text-secondary">
            New customers get 10% off their first 5 orders, applied automatically. A voucher code applies instead if it saves you more.
          </p>

          <p className="border-l-4 border-accent bg-accent-soft px-3 py-2 text-caption font-semibold uppercase text-text-primary">
            Cash on delivery only — pay when you receive your order.
          </p>

          {problem && (
            <p className="text-caption text-accent">
              Some items are unavailable or over stock. <Link href="/cart" className="underline">Review your cart</Link>.
            </p>
          )}
          {message && <p role="alert" className="text-caption text-accent">{message}</p>}

          <button
            type="submit"
            form="checkout-form"
            disabled={pending || problem}
            className="h-12 w-full rounded-sm bg-accent text-button uppercase text-text-on-dark transition-all duration-200 enabled:hover:-translate-y-px enabled:hover:bg-accent-hover enabled:hover:shadow-accent disabled:cursor-not-allowed disabled:bg-bg-tertiary disabled:text-text-muted"
          >
            {pending ? "Placing order…" : "Place order"}
          </button>
        </div>
      </aside>
    </div>
  );
}
