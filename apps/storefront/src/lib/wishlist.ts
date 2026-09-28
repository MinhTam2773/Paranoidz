import { useSyncExternalStore } from "react";
import { createClient } from "@paranoidz/db/client";

// Wishlist = the signed-in user's product ids, read and written from the browser under the
// wishlists_own RLS policy (ARCHITECTURE.md §2.2). Kept out of page renders so catalog pages stay
// ISR-cached. One module-level store shared by every heart on the page.
export type WishlistState = { status: "loading" | "guest" | "ready"; ids: ReadonlySet<string> };

const LOADING: WishlistState = { status: "loading", ids: new Set() };
const listeners = new Set<() => void>();
let state = LOADING;
// undefined = no auth event yet. Set before the list loads, so one load per user.
let userId: string | null | undefined = undefined;
let started = false;

// A guest's heart tap, finished after whichever login they pick (modal, Google/Facebook return,
// signup confirmation link). Expires so an abandoned tap can't surprise a later login.
const PENDING_KEY = "pz-wishlist-pending";
const PENDING_TTL = 30 * 60 * 1000;

function set(next: WishlistState) {
  state = next;
  listeners.forEach((l) => l());
}

function start() {
  if (started) return;
  started = true;
  // Fires INITIAL_SESSION right away, then on every login / logout / token refresh.
  createClient().auth.onAuthStateChange((_event, session) => {
    const id = session?.user.id ?? null;
    // Same user (token refresh, or a second event while the first load is still running): a
    // second load could land after a heart tap and put the pre-tap list back on screen.
    if (id === userId) return;
    userId = id;
    if (!id) return set({ status: "guest", ids: new Set() });
    // Supabase calls made inside this callback can deadlock the auth client; run them after it.
    setTimeout(() => load(id), 0);
  });
}

async function load(id: string) {
  const { data, error } = await createClient().from("wishlists").select("product_id");
  if (userId !== id) return; // logged out / switched while loading
  set({ status: "ready", ids: new Set(error ? [] : data.map((r) => r.product_id)) });
  const pending = takePending();
  if (pending && !state.ids.has(pending)) void toggleWishlist(pending);
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useWishlist() {
  return useSyncExternalStore(subscribe, () => state, () => LOADING);
}

/** Optimistic add/remove; rolls back if the write fails. Resolves to whether it stuck. */
export async function toggleWishlist(productId: string) {
  if (!userId || state.status !== "ready") return false;
  const had = state.ids.has(productId);
  const optimistic = new Set(state.ids);
  if (had) optimistic.delete(productId);
  else optimistic.add(productId);
  set({ status: "ready", ids: optimistic });

  const table = createClient().from("wishlists");
  const { error } = had
    ? await table.delete().eq("product_id", productId).eq("user_id", userId)
    : await table.upsert({ user_id: userId, product_id: productId }, { onConflict: "user_id,product_id", ignoreDuplicates: true });
  if (!error) return true;
  const reverted = new Set(state.ids);
  if (had) reverted.add(productId);
  else reverted.delete(productId);
  set({ status: "ready", ids: reverted });
  return false;
}

export function setPendingWishlist(productId: string) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ productId, at: Date.now() }));
  } catch {
    // Storage blocked: the heart just won't be re-applied after login.
  }
}

export function clearPendingWishlist() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {}
}

function takePending(): string | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    localStorage.removeItem(PENDING_KEY);
    const p = raw ? JSON.parse(raw) : null;
    return typeof p?.productId === "string" && Date.now() - p.at < PENDING_TTL ? p.productId : null;
  } catch {
    return null;
  }
}
