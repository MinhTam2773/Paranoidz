import { headers } from "next/headers";
import { createAdminClient } from "@paranoidz/db/admin";

// Per-IP + per-phone attempt counter for public server actions (ARCHITECTURE.md §6), backed by
// hit_rate_limit(): 1-hour windows, one counter set per scope. true = allowed.
// Vercel overwrites x-real-ip / x-forwarded-for with the real client IP, so they can't be spoofed
// there. No IP (unexpected off Vercel) → only the phone limit applies.
export async function hitRateLimit(scope: "order" | "lookup", phone: string, limits: { ip: number; phone: number }) {
  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0].trim() ?? "";
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
