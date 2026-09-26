import { PROVINCE_NAMES } from "./provinces";

// Checkout field rules, shared by the form (live, per field) and the placeOrder server action
// (authoritative). place_order() still re-validates the phone in SQL (normalize_vn_phone).
export type CheckoutField =
  | "name" | "phone" | "secondaryPhone" | "email" | "address" | "ward" | "city" | "note" | "voucher";
export type CheckoutValues = Record<CheckoutField, string>;
export type FieldErrors = Partial<Record<CheckoutField, string>>;

export const CHECKOUT_FIELDS: CheckoutField[] = [
  "name", "phone", "address", "ward", "city", "secondaryPhone", "email", "note", "voucher",
];

export const MAX_LENGTH: Record<CheckoutField, number> = {
  name: 100, phone: 15, secondaryPhone: 15, email: 200, address: 200, ward: 100, city: 50, note: 500, voucher: 30,
};

/** Mirrors public.normalize_vn_phone(): VN mobile → "0901234567", else null. */
export function normalizePhone(raw: string) {
  const d = raw.replace(/\D/g, "");
  if (/^0[35789]\d{8}$/.test(d)) return d;
  if (/^84[35789]\d{8}$/.test(d)) return "0" + d.slice(2);
  return null;
}

/** "0901234567" → "0901 234 567" for display; anything invalid is returned unchanged. */
export function formatPhone(raw: string) {
  const n = normalizePhone(raw);
  return n ? `${n.slice(0, 4)} ${n.slice(4, 7)} ${n.slice(7)}` : raw;
}

/** What each field may contain while typing (stripped on input, before validation). */
export const ALLOWED_CHARS: Partial<Record<CheckoutField, RegExp>> = {
  phone: /[^0-9+ ]/g,
  secondaryPhone: /[^0-9+ ]/g,
  voucher: /[^A-Za-z0-9-]/g,
};

const NAME = /^[\p{L}][\p{L} .'-]*$/u;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_HELP = "Enter a Vietnamese mobile number: 10 digits starting with 03, 05, 07, 08 or 09.";

export function validateField(field: CheckoutField, raw: string, all: Partial<CheckoutValues> = {}): string | undefined {
  const v = raw.trim();
  if (v.length > MAX_LENGTH[field]) return `Keep this under ${MAX_LENGTH[field]} characters.`;
  switch (field) {
    case "name":
      if (!v) return "Enter the recipient's full name.";
      if (v.length < 2 || !NAME.test(v)) return "Use letters only (no numbers or symbols).";
      return;
    case "phone":
      if (!v) return "Enter a phone number so we can confirm your order.";
      return normalizePhone(v) ? undefined : PHONE_HELP;
    case "secondaryPhone":
      if (!v) return;
      if (!normalizePhone(v)) return PHONE_HELP;
      if (normalizePhone(v) === normalizePhone(all.phone ?? "")) return "Use a different number from the main one.";
      return;
    case "address":
      if (!v) return "Enter the house number and street.";
      return v.length < 5 ? "This address looks too short." : undefined;
    case "ward":
      return v ? undefined : "Enter the ward or commune.";
    case "city":
      if (!v) return "Choose your city or province.";
      return PROVINCE_NAMES.has(v) ? undefined : "Choose a city or province from the list.";
    case "email":
      return !v || EMAIL.test(v) ? undefined : "Enter a valid email, e.g. name@gmail.com.";
    case "voucher":
      return !v || /^[A-Za-z0-9-]+$/.test(v) ? undefined : "Codes use letters, numbers and dashes only.";
    case "note":
      return;
  }
}

export function validateAll(values: CheckoutValues): FieldErrors {
  const errors: FieldErrors = {};
  for (const f of CHECKOUT_FIELDS) {
    const e = validateField(f, values[f] ?? "", values);
    if (e) errors[f] = e;
  }
  return errors;
}
