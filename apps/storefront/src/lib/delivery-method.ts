// Customer-chosen delivery method, picked on the product page and confirmed at checkout.
// Persisted in localStorage so the product-page choice carries into checkout.

export type DeliveryMethod = "standard" | "express";

const KEY = "pdz_delivery_method";

export const DELIVERY_METHODS: { value: DeliveryMethod; label: string; sub: string }[] = [
  {
    value: "standard",
    label: "Giao thường",
    sub: "SPX · 1–2 ngày (HCM), 2–5 ngày (tỉnh)",
  },
  {
    value: "express",
    label: "⚡ Hoả tốc nội thành HCM",
    sub: "Giao hàng gấp — gọi 0903715249",
  },
];

export function getDeliveryMethod(): DeliveryMethod {
  if (typeof window === "undefined") return "standard";
  return window.localStorage.getItem(KEY) === "express" ? "express" : "standard";
}

export function setDeliveryMethod(m: DeliveryMethod) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, m);
}

export function deliveryMethodLabel(m: DeliveryMethod): string {
  return m === "express" ? "Hoả tốc (nội thành HCM)" : "Giao thường";
}
