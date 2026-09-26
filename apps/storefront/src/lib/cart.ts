import { useSyncExternalStore } from "react";

// Cart = variant ids + quantities in localStorage (per browser). Works before login, and keeps
// the root layout cookie-free so catalog pages can be ISR-cached. Prices and stock are never
// stored: the cart page re-reads them, and place_order() recomputes everything server-side.
export type CartLine = { variantId: string; qty: number };

const KEY = "pz-cart";
const EMPTY: CartLine[] = [];
const listeners = new Set<() => void>();
// useSyncExternalStore needs a stable snapshot, so parse once and reuse until the next write.
let snapshot: CartLine[] | null = null;

function read(): CartLine[] {
  if (snapshot) return snapshot;
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    snapshot = Array.isArray(parsed)
      ? parsed.filter(
          (l): l is CartLine => typeof l?.variantId === "string" && Number.isInteger(l?.qty) && l.qty > 0,
        )
      : EMPTY;
  } catch {
    snapshot = EMPTY; // corrupt JSON or storage blocked (private mode)
  }
  return snapshot;
}

function write(lines: CartLine[]) {
  snapshot = lines;
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    // Storage blocked: the cart still works for this page view.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab changed the cart.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    snapshot = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCart() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function cartItemCount() {
  return read().reduce((sum, l) => sum + l.qty, 0);
}

/** Adds up to `qty`, never past `stock` in total. Returns how many were actually added. */
export function addToCart(variantId: string, qty: number, stock: number) {
  const lines = read();
  const current = lines.find((l) => l.variantId === variantId)?.qty ?? 0;
  const next = Math.min(current + qty, stock);
  if (next <= current) return 0;
  write(
    current
      ? lines.map((l) => (l.variantId === variantId ? { ...l, qty: next } : l))
      : [...lines, { variantId, qty: next }],
  );
  return next - current;
}

export function setCartQty(variantId: string, qty: number) {
  write(read().map((l) => (l.variantId === variantId ? { ...l, qty } : l)));
}

export function removeFromCart(variantId: string) {
  write(read().filter((l) => l.variantId !== variantId));
}

/** After a successful cart checkout only — never for Buy It Now. */
export function clearCart() {
  write([]);
}
