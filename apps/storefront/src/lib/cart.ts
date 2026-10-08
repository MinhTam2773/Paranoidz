import { useSyncExternalStore } from "react";
import { createClient } from "@paranoidz/db/client";

// Cart = variant ids + quantities. Guests: localStorage (per browser). Signed in: the cart_items
// table (own rows under RLS), so the cart follows the account across devices. On login the browser
// cart is merged into the account (merge_cart(): summed, capped at stock) and cleared; on logout
// the browser cart is cleared, so the next person on this browser starts empty. Client-side only,
// which keeps the root layout cookie-free for ISR. Prices and stock are never stored: the cart page
// re-reads them, and place_order() recomputes everything server-side.
export type CartLine = { variantId: string; qty: number };

const KEY = "pz-cart";
const EMPTY: CartLine[] = [];
const listeners = new Set<() => void>();
// useSyncExternalStore needs a stable snapshot. Guest: parsed once from localStorage and reused
// until the next write (null = re-read). Signed in: the account cart as last loaded / edited.
let snapshot: CartLine[] | null = null;
// undefined = no auth event yet, null = guest, else the signed-in user.
let userId: string | null | undefined = undefined;
// False until the first auth event is handled and, when signed in, the account cart has loaded —
// so the cart page doesn't flash "empty" first.
let ready = false;
let started = false;
// Account writes run one at a time, in order, so quick stepper taps can't land out of order.
let queue = Promise.resolve();

function readLocal(): CartLine[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter(
          (l): l is CartLine => typeof l?.variantId === "string" && Number.isInteger(l?.qty) && l.qty > 0,
        )
      : EMPTY;
  } catch {
    return EMPTY; // corrupt JSON or storage blocked (private mode)
  }
}

function clearLocal() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

function read(): CartLine[] {
  return (snapshot ??= readLocal());
}

function emit() {
  listeners.forEach((l) => l());
}

function write(lines: CartLine[]) {
  snapshot = lines;
  if (!userId) {
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      // Storage blocked: the cart still works for this page view.
    }
  }
  emit();
}

function start() {
  if (started) return;
  started = true;
  // Fires INITIAL_SESSION right away, then on every login / logout / token refresh.
  createClient().auth.onAuthStateChange((_event, session) => {
    const id = session?.user.id ?? null;
    if (id === userId) return; // token refresh
    const wasSignedIn = !!userId;
    userId = id;
    if (!id) {
      if (wasSignedIn) clearLocal();
      snapshot = null;
      ready = true;
      return emit();
    }
    // Keep showing the browser cart until the account cart arrives.
    snapshot = readLocal();
    ready = false;
    emit();
    // Supabase calls made inside this callback can deadlock the auth client; run them after it.
    setTimeout(() => enqueue(() => login(id)), 0);
  });
  // Back to this tab: pick up changes made on another device or tab.
  document.addEventListener("visibilitychange", () => {
    const id = userId;
    if (id && ready && document.visibilityState === "visible") enqueue(() => load(id));
  });
}

// Supabase reports failures as `error`, not by throwing; the catch only keeps a thrown network
// error from stalling the queue.
function enqueue(task: () => Promise<void>) {
  queue = queue.then(task).catch(() => {});
}

async function login(id: string) {
  const local = readLocal();
  if (local.length) {
    const { error } = await createClient().rpc("merge_cart", {
      p_lines: local.map((l) => ({ variant_id: l.variantId, qty: l.qty })),
    });
    // On failure the browser copy stays and the next page load merges it again.
    if (!error) clearLocal();
  }
  await load(id);
}

async function load(id: string) {
  const { data, error } = await createClient().from("cart_items").select("variant_id, qty").order("created_at");
  if (userId !== id) return; // logged out / switched while loading
  if (!error) snapshot = data.map((r) => ({ variantId: r.variant_id, qty: r.qty }));
  ready = true;
  emit();
}

// Signed in: apply an account write after the queued ones; on failure, show the table's truth.
// `reload` also re-reads after success — for a write issued before the account cart loaded.
function sync(op: (id: string) => PromiseLike<{ error: unknown }>, reload = false) {
  const id = userId;
  if (!id) return;
  enqueue(async () => {
    if (userId !== id) return;
    const { error } = await op(id);
    if (error || reload) await load(id);
  });
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  // Another tab changed the guest cart.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY || userId) return;
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

/** False while a signed-in user's cart is still loading. */
export function useCartReady() {
  return useSyncExternalStore(subscribe, () => ready, () => false);
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
  // A delta, not the new total: merge_cart() adds it to whatever the account holds (capped at stock).
  sync(() => createClient().rpc("merge_cart", { p_lines: [{ variant_id: variantId, qty: next - current }] }), !ready);
  return next - current;
}

export function setCartQty(variantId: string, qty: number) {
  write(read().map((l) => (l.variantId === variantId ? { ...l, qty } : l)));
  sync((id) => createClient().from("cart_items").update({ qty }).eq("user_id", id).eq("variant_id", variantId));
}

export function removeFromCart(variantId: string) {
  write(read().filter((l) => l.variantId !== variantId));
  sync((id) => createClient().from("cart_items").delete().eq("user_id", id).eq("variant_id", variantId));
}

/** After a successful cart checkout only — never for Buy It Now. */
export function clearCart() {
  write([]);
  sync((id) => createClient().from("cart_items").delete().eq("user_id", id));
}
