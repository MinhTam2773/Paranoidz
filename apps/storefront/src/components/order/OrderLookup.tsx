"use client";

import { useState, useTransition, type FormEvent } from "react";
import { lookupOrder, type LookedUpOrder } from "@/app/order-lookup/actions";
import { normalizePhone } from "@/lib/checkout-validation";
import { parseOrderNumber } from "@/lib/order-number";
import { placedOn, STATUS } from "@/lib/order-status";
import { HOTLINE } from "@/lib/site";
import { OrderSummary } from "./OrderSummary";

// 16px on mobile so iOS Safari doesn't zoom on focus (same exception as checkout).
const inputClass =
  "h-11 w-full rounded-sm border bg-bg-primary px-3 text-base text-text-primary lg:text-product-name placeholder:text-text-muted focus:border-text-primary focus:shadow-[0_0_0_2px_var(--color-accent-soft)] focus:outline-none";
const secondaryClass =
  "flex h-12 w-full items-center justify-center rounded-sm border border-text-primary text-button uppercase text-text-primary transition-colors duration-200 hover:bg-text-primary hover:text-text-on-dark";

type Errors = { orderNumber?: string; phone?: string };

export function OrderLookup({ defaultOrderNumber }: { defaultOrderNumber: string }) {
  const [order, setOrder] = useState<LookedUpOrder | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const input = { orderNumber: String(form.get("orderNumber") ?? ""), phone: String(form.get("phone") ?? "") };
    // Same checks as the server, so a typo doesn't spend a rate-limited lookup.
    const errs: Errors = {};
    if (!parseOrderNumber(input.orderNumber)) errs.orderNumber = "Enter your order number, e.g. PZ-2026-0123.";
    if (!normalizePhone(input.phone)) errs.phone = "Enter the phone number you ordered with: 10 digits starting with 03, 05, 07, 08 or 09.";
    setErrors(errs);
    setMessage(undefined);
    if (errs.orderNumber || errs.phone) {
      document.getElementById(errs.orderNumber ? "lookup-orderNumber" : "lookup-phone")?.focus();
      return;
    }
    startTransition(async () => {
      const res = await lookupOrder(input);
      if (res.ok) return setOrder(res.order);
      if (res.field) setErrors({ [res.field]: res.message });
      else setMessage(res.message);
    });
  }

  if (order) {
    const status = STATUS[order.status];
    return (
      <div role="status" className="flex max-w-xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-caption text-text-secondary">
            Order <strong className="text-text-primary">{order.orderNumber}</strong> · Placed {placedOn.format(new Date(order.createdAt))}
          </p>
          <h2 className="text-h3 uppercase">{status.label}</h2>
          <p className="text-text-secondary">{status.detail}</p>
        </div>

        <OrderSummary items={order.items} subtotal={order.subtotal} discount={order.discount} total={order.total}>
          <p className="text-caption text-text-muted">
            Delivering to {[order.ward, order.city].filter(Boolean).join(", ")}. To change anything, call {HOTLINE}.
          </p>
        </OrderSummary>

        <button type="button" onClick={() => setOrder(null)} className={`${secondaryClass} max-w-xs`}>
          Look up another order
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex max-w-md flex-col gap-6">
      <p className="text-text-secondary">Enter the order number from your confirmation and the phone number you ordered with.</p>
      <div className="flex flex-col gap-2">
        <label htmlFor="lookup-orderNumber" className="text-nav uppercase text-text-secondary">Order number</label>
        <input
          id="lookup-orderNumber"
          name="orderNumber"
          defaultValue={defaultOrderNumber}
          placeholder="PZ-2026-0123"
          autoComplete="off"
          maxLength={20}
          aria-invalid={!!errors.orderNumber}
          aria-describedby={errors.orderNumber ? "lookup-orderNumber-error" : undefined}
          className={`${inputClass} uppercase ${errors.orderNumber ? "border-accent" : "border-border"}`}
        />
        {errors.orderNumber && <p id="lookup-orderNumber-error" className="text-caption text-accent">{errors.orderNumber}</p>}
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="lookup-phone" className="text-nav uppercase text-text-secondary">Phone number</label>
        <input
          id="lookup-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0901 234 567"
          maxLength={15}
          aria-invalid={!!errors.phone}
          aria-describedby={errors.phone ? "lookup-phone-error" : undefined}
          className={`${inputClass} ${errors.phone ? "border-accent" : "border-border"}`}
        />
        {errors.phone && <p id="lookup-phone-error" className="text-caption text-accent">{errors.phone}</p>}
      </div>
      {message && <p role="alert" className="text-caption text-accent">{message}</p>}
      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-sm bg-accent text-button uppercase text-text-on-dark transition-all duration-200 enabled:hover:-translate-y-px enabled:hover:bg-accent-hover enabled:hover:shadow-accent disabled:cursor-not-allowed disabled:bg-bg-tertiary disabled:text-text-muted"
      >
        {pending ? "Looking up…" : "Look up order"}
      </button>
    </form>
  );
}
