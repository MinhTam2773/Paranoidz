"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type FocusEvent, type FormEvent, type ReactNode } from "react";
import { getCartItems, type CartItem } from "@/app/cart/actions";
import { placeOrder, previewShipping, quoteGachaCode, quoteOrder, type CheckoutResult, type GachaQuote, type OrderQuote } from "@/app/checkout/actions";
import type { SavedAddress } from "@/components/account/AddressBook";
import { clearCart, useCart, useCartReady, type CartLine } from "@/lib/cart";
import {
  ALLOWED_CHARS,
  CHECKOUT_FIELDS,
  MAX_LENGTH,
  formatPhone,
  normalizePhone,
  validateAll,
  validateField,
  type CheckoutField,
  type CheckoutValues,
  type FieldErrors,
} from "@/lib/checkout-validation";
import { formatVnd } from "@/lib/format";
import { GACHA_PRIZES, isGachaCode, type GachaPrizeType } from "@/lib/gacha";
import {
  DELIVERY_METHODS,
  deliveryMethodLabel,
  getDeliveryMethod,
  setDeliveryMethod,
  type DeliveryMethod,
} from "@/lib/delivery-method";
import { ProvinceSelect } from "./ProvinceSelect";
import { WardSelect } from "./WardSelect";

type Placed = Extract<CheckoutResult, { ok: true }>["order"];

// Signed-in customer: pre-fill source. Addresses come default-first, then newest.
export type CheckoutAccount = { name: string; phone: string; email: string; addresses: SavedAddress[] } | null;

// Text fields a saved address fills; typing in any of them unlinks the address (orders.address_id).
// Province and ward are pickers with their own state.
const ADDRESS_FIELDS = ["name", "phone", "address"] as const;

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
        {required ? <span className="text-accent"> *</span> : <span className="normal-case tracking-normal text-text-muted"> (không bắt buộc)</span>}
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
export function CheckoutView({ buyNow, account }: { buyNow: CartLine | null; account: CheckoutAccount }) {
  const cart = useCart();
  const cartReady = useCartReady();
  const lines = buyNow ? [buyNow] : cart;
  const [items, setItems] = useState<Map<string, CartItem> | null>(null);
  const [message, setMessage] = useState<string | undefined>();
  const [errors, setErrors] = useState<FieldErrors>({});
  const initial = account?.addresses[0];
  const [city, setCity] = useState(initial?.city ?? "");
  const [ward, setWard] = useState(initial?.ward ?? "");
  const [addressId, setAddressId] = useState<string | null>(initial?.id ?? null);
  const [placed, setPlaced] = useState<Placed | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const idsKey = lines.map((l) => l.variantId).toSorted().join(",");
  const linesKey = lines.map((l) => `${l.variantId}:${l.qty}`).toSorted().join(",");
  // Shipping quote (SPX live, else the table) for the chosen province + ward and the lines:
  // undefined while loading, null if it can't be quoted.
  const [shipping, setShipping] = useState<{ key: string; quote: { fee: number; source: "spx" | "table" } | null } | null>(null);
  const shippingKey = `${city}|${ward}|${linesKey}`;
  const shippingQuote = shipping?.key === shippingKey ? shipping.quote : undefined;
  const shippingFee = shippingQuote?.fee;
  // Live discount (quoteOrder): re-asked when the lines, the phone or the code change. The last
  // answer stays on screen while the next one loads; null = couldn't quote.
  const [phone, setPhone] = useState(initial?.phone ?? account?.phone ?? "");
  const [voucher, setVoucher] = useState("");
  const [quote, setQuote] = useState<{ key: string; value: OrderQuote | null } | null>(null);
  // Gacha prize codes (GACHA-…) share the code field but quote separately:
  // their effect is its own summary line, never part of the voucher discount.
  const [gachaQuote, setGachaQuote] = useState<{ key: string; value: GachaQuote | null } | null>(null);
  // Delivery method: pre-selected from the product-page choice (localStorage).
  const [deliveryMethod, setDeliveryMethodState] = useState<DeliveryMethod>(() => getDeliveryMethod());
  const pickDelivery = (m: DeliveryMethod) => {
    setDeliveryMethodState(m);
    setDeliveryMethod(m);
  };
  const isHcm = city === "TP. Hồ Chí Minh";
  const expressBlocked = deliveryMethod === "express" && city !== "" && !isHcm;
  const quotePhone = normalizePhone(phone) ?? "";
  const quoteVoucher = voucher.trim().toUpperCase();
  const quoteKey = `${linesKey}|${quotePhone}|${quoteVoucher}`;
  const gachaKey = `${linesKey}|${quoteVoucher}`;

  useEffect(() => {
    let cancelled = false;
    (idsKey ? getCartItems(idsKey.split(",")) : Promise.resolve([])).then((res) => {
      if (!cancelled) setItems(new Map(res.map((i) => [i.variantId, i])));
    });
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  useEffect(() => {
    if (!city || !ward || !linesKey) return;
    let cancelled = false;
    const items = linesKey.split(",").map((s) => ({ variantId: s.split(":")[0], qty: Number(s.split(":")[1]) }));
    previewShipping({ city, ward, items }).then((quote) => {
      if (!cancelled) setShipping({ key: `${city}|${ward}|${linesKey}`, quote });
    });
    return () => {
      cancelled = true;
    };
  }, [city, ward, linesKey]);

  useEffect(() => {
    if (!linesKey) return;
    let cancelled = false;
    const items = linesKey.split(",").map((s) => ({ variantId: s.split(":")[0], qty: Number(s.split(":")[1]) }));
    // Debounced: the code field re-quotes as it's typed.
    const timer = setTimeout(() => {
      quoteOrder({ items, phone: quotePhone, voucher: quoteVoucher }).then((value) => {
        if (!cancelled) setQuote({ key: `${linesKey}|${quotePhone}|${quoteVoucher}`, value });
      });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [linesKey, quotePhone, quoteVoucher]);

  useEffect(() => {
    if (!linesKey || !isGachaCode(quoteVoucher)) return;
    let cancelled = false;
    const items = linesKey.split(",").map((s) => ({ variantId: s.split(":")[0], qty: Number(s.split(":")[1]) }));
    const timer = setTimeout(() => {
      quoteGachaCode({ items, code: quoteVoucher }).then((value) => {
        if (!cancelled) setGachaQuote({ key: `${linesKey}|${quoteVoucher}`, value });
      });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [linesKey, quoteVoucher]);

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
    if ((ADDRESS_FIELDS as readonly string[]).includes(f.field)) setAddressId(null);
    const strip = ALLOWED_CHARS[f.field];
    if (strip) {
      const clean = f.el.value.replace(strip, "");
      if (clean !== f.el.value) f.el.value = clean;
    }
    if (f.field === "phone") setPhone(f.el.value);
    if (f.field === "voucher") setVoucher(f.el.value);
    if (errors[f.field]) check(f.field, f.el.value);
  }

  function onBlur(e: FocusEvent<HTMLDivElement>) {
    const f = fieldOf(e.target);
    if (!f) return;
    if (f.field === "phone" || f.field === "secondaryPhone") f.el.value = formatPhone(f.el.value);
    if (f.el.value.trim() || errors[f.field]) check(f.field, f.el.value);
  }

  // Saved address picker: fill the fields from it, or clear them for a new address (name and
  // phone fall back to the profile).
  function pick(id: string) {
    const a = account?.addresses.find((x) => x.id === id);
    const fill = a ?? { name: account?.name ?? "", phone: account?.phone ?? "", address: "", ward: "", city: "" };
    const form = formRef.current!;
    for (const k of ADDRESS_FIELDS) (form.elements.namedItem(k) as HTMLInputElement).value = k === "phone" ? formatPhone(fill.phone) : fill[k];
    setCity(fill.city);
    setWard(fill.ward ?? "");
    setPhone(fill.phone);
    setAddressId(a?.id ?? null);
    setErrors((e) => ({ ...e, name: undefined, phone: undefined, address: undefined, ward: undefined, city: undefined }));
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = values();
    const errs = validateAll(v);
    setErrors(errs);
    setMessage(undefined);
    if (Object.keys(errs).length) return focusFirst(errs);
    // Express is HCMC-only: don't let the order through with a mismatched address.
    if (deliveryMethod === "express" && v.city !== "TP. Hồ Chí Minh") {
      setMessage("⚡ Hoả tốc chỉ áp dụng nội thành TP.HCM. Vui lòng chọn giao thường hoặc đổi địa chỉ.");
      return;
    }
    startTransition(async () => {
      const res: CheckoutResult = await placeOrder({
        items: lines.map((l) => ({ variantId: l.variantId, qty: l.qty })),
        addressId: addressId ?? undefined,
        deliveryMethod,
        ...v,
      });
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
          <h2 className="text-h3 uppercase">Cảm ơn bạn — đã đặt hàng thành công</h2>
          <p className="text-text-secondary">
            Mã đơn hàng của bạn là <strong className="text-text-primary">{placed.orderNumber}</strong>. Chúng tôi sẽ chuẩn bị và giao hàng
            đến bạn. Bạn thanh toán bằng tiền mặt khi nhận hàng.
          </p>
          <p className="text-text-secondary">
            Theo dõi trạng thái bất cứ lúc nào tại trang{" "}
            <Link href={`/order-lookup?order=${placed.orderNumber}`} className="text-text-primary underline">tra cứu đơn hàng</Link>{" "}
            bằng mã đơn và số điện thoại của bạn.
          </p>
        </div>
        <dl className="flex flex-col gap-3 rounded-sm border border-border p-6">
          <div className="flex justify-between"><dt className="text-text-secondary">Tạm tính</dt><dd>{formatVnd(placed.subtotal)}</dd></div>
          {placed.discount > 0 && (
            <div className="flex justify-between"><dt className="text-text-secondary">Giảm giá</dt><dd className="text-accent">−{formatVnd(placed.discount)}</dd></div>
          )}
          {placed.gachaDiscount > 0 && (
            <div className="flex justify-between"><dt className="text-text-secondary">Quà quay thưởng</dt><dd className="text-accent">−{formatVnd(placed.gachaDiscount)}</dd></div>
          )}
          {placed.gachaGift && (
            <div className="flex justify-between"><dt className="text-text-secondary">Quà tặng kèm</dt><dd>{placed.gachaGift}</dd></div>
          )}
          <div className="flex justify-between"><dt className="text-text-secondary">Phí vận chuyển</dt><dd>{formatVnd(placed.shippingFee)}</dd></div>
          <div className="flex justify-between"><dt className="text-text-secondary">Phương thức giao hàng</dt><dd>{deliveryMethodLabel(placed.deliveryMethod === "express" ? "express" : "standard")}</dd></div>
          <div className="flex justify-between border-t border-border pt-3">
            <dt className="text-nav uppercase">Tổng thanh toán khi nhận hàng</dt><dd className="text-price">{formatVnd(placed.total)}</dd>
          </div>
        </dl>
        <Link href="/products" className={`${secondaryClass} max-w-xs`}>Tiếp tục mua sắm</Link>
      </div>
    );
  }

  if (!items || (!buyNow && !cartReady)) return <p className="text-text-secondary">Đang tải đơn hàng…</p>;

  if (!lines.length) {
    return (
      <div className="flex flex-col items-start gap-6">
        <p className="text-text-secondary">Giỏ hàng của bạn đang trống.</p>
        <Link href="/products" className={`${secondaryClass} max-w-xs`}>Tiếp tục mua sắm</Link>
      </div>
    );
  }

  const rows = lines.map((line) => ({ line, item: items.get(line.variantId) }));
  const problem = rows.some(({ line, item }) => !item || line.qty > item.stock);
  const subtotal = rows.reduce((sum, { line, item }) => sum + (item ? item.price * line.qty : 0), 0);
  const priced = quote?.value ?? null; // last answer, possibly for older inputs while re-quoting
  const fresh = quote?.key === quoteKey ? quote.value : undefined;
  const shippingKnown = !!city && !!ward && typeof shippingFee === "number";
  // Gacha prize preview: only the fresh answer for the current code + lines counts.
  const gachaFresh = gachaQuote?.key === gachaKey ? gachaQuote.value : undefined;
  const gachaApplied = isGachaCode(quoteVoucher) && gachaFresh?.ok ? gachaFresh : null;
  const gachaError = isGachaCode(quoteVoucher) && gachaFresh && !gachaFresh.ok ? gachaFresh.message : undefined;
  const gachaDiscount = gachaApplied?.discount ?? 0;
  const shippingDue = gachaApplied?.freeship ? 0 : shippingKnown ? shippingFee : undefined;
  const discountLabel =
    priced?.source === "auto_first5" ? `Ưu đãi 5 đơn đầu (−${priced.pct}%)`
    : priced?.source === "promo" ? `Mã ${priced.code} (−${priced.pct}%)`
    : priced?.source === "bundle" ? `Combo: ${priced.bundles.map((b) => (b.sets > 1 ? `${b.name} ×${b.sets}` : b.name)).join(", ")}`
    : "Giảm giá";
  return (
    <div onInput={onInput} onBlur={onBlur} className="grid gap-8 lg:grid-cols-12 lg:gap-12">
      <form ref={formRef} id="checkout-form" onSubmit={submit} noValidate className="flex flex-col gap-6 lg:col-span-7">
        <h2 className="text-h3 uppercase"><span className="mr-2 text-accent">01</span>Thông tin giao hàng</h2>
        {!!account?.addresses.length && (
          <div className="flex flex-col gap-2">
            <label htmlFor="checkout-saved" className="text-nav uppercase text-text-secondary">Địa chỉ đã lưu</label>
            <select
              id="checkout-saved"
              value={addressId ?? ""}
              onChange={(e) => pick(e.target.value)}
              className={`${inputClass} h-11 border-border`}
            >
              {account.addresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} — {[a.address, a.ward, a.city].join(", ")}{a.isDefault ? " (default)" : ""}
                </option>
              ))}
              <option value="">Địa chỉ mới</option>
            </select>
          </div>
        )}
        <div className="grid gap-6 sm:grid-cols-2">
          <Field name="name" label="Họ tên" required error={errors.name}>
            {(p) => <input {...p} className={`${p.className} h-11`} defaultValue={initial?.name ?? account?.name} autoComplete="name" maxLength={MAX_LENGTH.name} />}
          </Field>
          <Field name="phone" label="Số điện thoại" required error={errors.phone}>
            {(p) => (
              <input
                {...p}
                className={`${p.className} h-11`}
                defaultValue={formatPhone(initial?.phone ?? account?.phone ?? "")}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="0901 234 567"
                maxLength={MAX_LENGTH.phone}
              />
            )}
          </Field>
          <Field name="address" label="Địa chỉ" required error={errors.address} className="sm:col-span-2">
            {(p) => <input {...p} className={`${p.className} h-11`} defaultValue={initial?.address} autoComplete="street-address" placeholder="Số nhà, tên đường" maxLength={MAX_LENGTH.address} />}
          </Field>
          <Field name="city" label="Tỉnh / thành phố" required error={errors.city}>
            {(p) => (
              <ProvinceSelect
                id={p.id}
                name={p.name}
                value={city}
                onChange={(v) => {
                  if (v !== city) setWard("");
                  setCity(v);
                  setAddressId(null);
                  check("city", v);
                }}
                invalid={p["aria-invalid"]}
                describedBy={p["aria-describedby"]}
              />
            )}
          </Field>
          <Field name="ward" label="Phường / xã" required error={errors.ward}>
            {(p) => (
              <WardSelect
                id={p.id}
                name={p.name}
                city={city}
                value={ward}
                onChange={(v) => {
                  setWard(v);
                  setAddressId(null);
                  check("ward", v);
                }}
                onResolve={setWard}
                invalid={p["aria-invalid"]}
                describedBy={p["aria-describedby"]}
              />
            )}
          </Field>
          <Field name="secondaryPhone" label="Số điện thoại phụ" error={errors.secondaryPhone}>
            {(p) => <input {...p} className={`${p.className} h-11`} type="tel" inputMode="tel" placeholder="Số dự phòng" maxLength={MAX_LENGTH.secondaryPhone} />}
          </Field>
          <Field name="email" label="Email" error={errors.email}>
            {(p) => <input {...p} className={`${p.className} h-11`} defaultValue={account?.email} type="email" autoComplete="email" placeholder="Để nhận xác nhận đơn hàng" maxLength={MAX_LENGTH.email} />}
          </Field>
          <Field name="note" label="Ghi chú đơn hàng" error={errors.note} className="sm:col-span-2">
            {(p) => <textarea {...p} className={`${p.className} py-3`} rows={3} placeholder="Hướng dẫn giao hàng" maxLength={MAX_LENGTH.note} />}
          </Field>
        </div>

        {/* 02 — Shipping method: standard (SPX live quote) or HCMC express.
            The product-page choice pre-selects this; the customer can change it here. */}
        <h2 className="text-h3 uppercase"><span className="mr-2 text-accent">02</span>Phương thức vận chuyển</h2>
        <div role="radiogroup" aria-label="Phương thức vận chuyển" className="flex flex-col gap-2">
          {DELIVERY_METHODS.map((m) => {
            const active = deliveryMethod === m.value;
            const isExpress = m.value === "express";
            return (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => pickDelivery(m.value)}
                className={`border bg-bg-primary transition-colors duration-200 ${
                  active ? "border-text-primary" : "border-border hover:border-border-hover"
                }`}
              >
                <span className="flex items-center gap-4 p-4">
                  <span
                    aria-hidden
                    className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200 ${
                      active ? "border-accent" : "border-border"
                    }`}
                  >
                    {active && <span className="size-2.5 rounded-full bg-accent" />}
                  </span>
                  <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center bg-bg-dark text-text-on-dark">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M5 12a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" />
                      <circle cx="9" cy="20" r="1.6" /><circle cx="17" cy="20" r="1.6" />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block text-nav font-bold uppercase">{isExpress ? "Hoả tốc" : "SPX Express"}</span>
                    <span className="mt-0.5 block text-caption text-text-secondary">{m.sub}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    {isExpress ? (
                      <span className="text-caption text-text-secondary">Giao hàng gấp:<br />☎ 0903715249</span>
                    ) : shippingKnown ? (
                      <>
                        <span className="block text-price">{formatVnd(shippingFee)}</span>
                        <span className="mt-0.5 block text-caption text-text-muted">
                          {shippingQuote?.source === "spx" ? "Giá trực tiếp từ SPX" : "Theo bảng giá chuẩn"}
                        </span>
                      </>
                    ) : (
                      <span className="text-caption text-text-secondary">
                        {!city || !ward ? "Nhập địa chỉ để tính phí" : "Đang tính…"}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {expressBlocked && (
          <p role="alert" className="rounded-sm border border-warning bg-warning/10 p-3 text-caption text-text-primary">
            ⚡ Hoả tốc chỉ áp dụng nội thành TP.HCM — địa chỉ của bạn ở {city}, đơn sẽ được giao thường. Vui lòng chọn lại hoặc đổi địa chỉ.
          </p>
        )}
        <p className="border border-border border-t-0 px-4 py-2.5 text-caption text-text-muted">
          Phí ship tính theo địa chỉ giao hàng và khối lượng đơn — mức bạn thấy là mức bạn trả, shop không thu thêm.
        </p>
      </form>

      <aside className="lg:col-span-5">
        <div className="flex flex-col gap-6 rounded-sm bg-bg-secondary p-6 lg:sticky lg:top-36">
          <h2 className="text-h3 uppercase">Tóm tắt đơn hàng</h2>
          <ul className="flex flex-col gap-4">
            {rows.map(({ line, item }) => (
              <li key={line.variantId} className="flex gap-3">
                <div className="relative aspect-square w-16 shrink-0 overflow-hidden rounded-sm bg-bg-tertiary">
                  {item?.imageUrl && <Image src={item.imageUrl} alt={item.name} fill sizes="64px" className="object-cover" />}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-product-name">{item?.name ?? "Sản phẩm không còn bán"}</span>
                  {item && <span className="text-caption uppercase text-text-secondary">{item.color} / {item.size} · SL {line.qty}</span>}
                  {item && line.qty > item.stock && <span className="text-caption text-accent">Chỉ còn {item.stock} sản phẩm</span>}
                </div>
                {item && <span className="text-product-name">{formatVnd(item.price * line.qty)}</span>}
              </li>
            ))}
          </ul>

          <Field name="voucher" label="Mã giảm giá" error={errors.voucher ?? (isGachaCode(quoteVoucher) ? gachaError : fresh?.voucherError ?? undefined)}>
            {(p) => <input {...p} form="checkout-form" className={`${p.className} h-11 uppercase`} autoComplete="off" maxLength={MAX_LENGTH.voucher} />}
          </Field>

          <dl className="flex flex-col gap-3 border-t border-border pt-4">
            <div className="flex justify-between"><dt className="text-text-secondary">Tạm tính</dt><dd>{formatVnd(subtotal)}</dd></div>
            <div className="flex justify-between gap-4">
              <dt className="min-w-0 wrap-break-word text-text-secondary">{discountLabel}</dt>
              {priced ? (
                <dd className={`shrink-0 ${(priced.discount - (priced.flashDiscount ?? 0)) > 0 ? "text-accent" : ""}`}>
                  {(priced.discount - (priced.flashDiscount ?? 0)) > 0 ? `−${formatVnd(priced.discount - (priced.flashDiscount ?? 0))}` : formatVnd(0)}
                </dd>
              ) : (
                <dd className="text-right text-caption text-text-secondary">{quote ? "Áp dụng khi đặt hàng" : "Đang tính…"}</dd>
              )}
            </div>
            {!!priced?.flashDiscount && (
              <div className="flex justify-between gap-4">
                <dt className="min-w-0 wrap-break-word text-text-secondary">⚡ Flash sale (−{priced.flashPct}%)</dt>
                <dd className="shrink-0 text-accent">−{formatVnd(priced.flashDiscount)}</dd>
              </div>
            )}
            {gachaApplied && (
              <div className="flex justify-between gap-4">
                <dt className="min-w-0 wrap-break-word text-text-secondary">
                  🎁 Quà quay thưởng{GACHA_PRIZES[gachaApplied.prizeType as GachaPrizeType] ? ` (${GACHA_PRIZES[gachaApplied.prizeType as GachaPrizeType].short})` : ""}
                </dt>
                <dd className="shrink-0 text-accent">
                  {gachaDiscount > 0 ? `−${formatVnd(gachaDiscount)}` : gachaApplied.gift ? "Tặng kèm đơn" : "Miễn phí ship"}
                </dd>
              </div>
            )}
            {gachaApplied?.gift && (
              <p className="-mt-1 text-caption text-text-muted">{gachaApplied.gift} — shop sẽ bỏ vào gói hàng của bạn.</p>
            )}
            {priced?.source === "auto_first5" && !priced.phoneKnown && (
              <p className="-mt-1 text-caption text-text-muted">Áp dụng cho 5 đơn đầu tiên của mỗi số điện thoại — kiểm tra lại khi bạn nhập số.</p>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-text-secondary">Phí vận chuyển <span className="text-caption text-text-muted">(SPX Express)</span></dt>
              {typeof shippingDue === "number" ? (
                <dd>{formatVnd(shippingDue)}{gachaApplied?.freeship && <span className="text-caption text-text-muted"> — quà quay thưởng</span>}</dd>
              ) : (
                <dd className="text-right text-caption text-text-secondary">
                  {!city ? "Chọn tỉnh / thành phố" : !ward ? "Chọn phường / xã" : shippingFee === undefined ? "Đang tính…" : "Tính khi đặt hàng"}
                </dd>
              )}
            </div>
            {priced ? (
              <div className="flex justify-between gap-4 border-t border-border pt-3">
                <dt className="text-nav uppercase">{typeof shippingDue === "number" ? "Tổng thanh toán" : "Tổng (chưa gồm phí vận chuyển)"}</dt>
                <dd className="shrink-0 text-price">{formatVnd(subtotal - priced.discount - gachaDiscount + (shippingDue ?? 0))}</dd>
              </div>
            ) : (
              typeof shippingDue === "number" && (
                <div className="flex justify-between gap-4 border-t border-border pt-3">
                  <dt className="text-nav uppercase">Tổng trước giảm giá</dt>
                  <dd className="text-price">{formatVnd(subtotal - gachaDiscount + shippingDue)}</dd>
                </div>
              )
            )}
          </dl>
          <p className="text-caption text-text-secondary">
            Khách hàng được giảm 10% cho 5 đơn đầu tiên, tự động áp dụng. Ưu đãi 5 đơn đầu, mã giảm giá và combo không cộng dồn — đơn hàng được mức giảm cao nhất.
          </p>

          <p className="border-l-4 border-accent bg-accent-soft px-3 py-2 text-caption font-semibold uppercase text-text-primary">
            Chỉ thanh toán khi nhận hàng (COD) — trả tiền khi bạn nhận được hàng.
          </p>

          {problem && (
            <p className="text-caption text-accent">
              Một số sản phẩm không còn bán hoặc vượt quá tồn kho. <Link href="/cart" className="underline">Kiểm tra giỏ hàng</Link>.
            </p>
          )}
          {message && <p role="alert" className="text-caption text-accent">{message}</p>}

          <button
            type="submit"
            form="checkout-form"
            disabled={pending || problem}
            className="h-12 w-full rounded-sm bg-accent text-button uppercase text-text-on-dark transition-all duration-200 enabled:hover:-translate-y-px enabled:hover:bg-accent-hover enabled:hover:shadow-accent disabled:cursor-not-allowed disabled:bg-bg-tertiary disabled:text-text-muted"
          >
            {pending ? "Đang đặt hàng…" : "Đặt hàng"}
          </button>
        </div>
      </aside>
    </div>
  );
}
