import { headers } from "next/headers";
import { createAdminClient } from "@paranoidz/db/admin";

// The visitor's IP, from the header the host itself overwrites so it can't be spoofed: Cloudflare's
// cf-connecting-ip, or x-real-ip / x-forwarded-for while the site is still on Vercel (where a
// client could send its own cf-connecting-ip). "" = unknown.
export function clientIp(h: Pick<Headers, "get">) {
  const forwarded = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0].trim();
  return (process.env.VERCEL ? forwarded : (h.get("cf-connecting-ip") ?? forwarded)) ?? "";
}

// Per-IP + per-phone attempt counter for public server actions (ARCHITECTURE.md §6), backed by
// hit_rate_limit(): 1-hour windows, one counter set per scope. true = allowed.
// No IP → only the phone limit applies.
export async function hitRateLimit(scope: "order" | "lookup" | "quote" | "shipping" | "gacha", phone: string, limits: { ip: number; phone: number }) {
  const ip = clientIp(await headers());
  const { data, error } = await createAdminClient().rpc("hit_rate_limit", {
    p_scope: scope,
    p_ip: ip,
    p_phone: phone,
    p_ip_limit: limits.ip,
    p_phone_limit: limits.phone,
  });
  if (error) throw error;
  return data;
}
