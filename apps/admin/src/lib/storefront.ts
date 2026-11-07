import "server-only";
import { after } from "next/server";
import { STORE_URL } from "@/lib/nav";

// The storefront's catalog pages are ISR, cached up to a day (Vercel ISR-writes cap, 2026-11-07).
// Call after any change they show — products, photos, stock, categories, collections, bundles,
// reviews — and they re-render on their next visit. Runs after the response, so a storefront
// that is down never fails the save. No REVALIDATE_SECRET (local, previews) = nothing sent.
export function revalidateStorefront() {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return;
  after(async () => {
    const res = await fetch(`${STORE_URL}/api/revalidate`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
    }).catch((e: unknown) => e);
    if (!(res instanceof Response) || !res.ok) {
      console.error("storefront revalidate failed", res instanceof Response ? res.status : res);
    }
  });
}
