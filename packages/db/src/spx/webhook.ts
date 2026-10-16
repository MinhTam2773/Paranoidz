// Pure logic for the SPX tracking webhook (ARCHITECTURE.md §5 "SPX Open API", phase 3).
// The Next route (apps/storefront/src/app/api/spx/webhook/route.ts) handles HTTP + signature;
// everything here is pure and unit-tested.

export type SpxTarget = "shipped" | "delivered" | "delivery_failed";

// SPX 4.1 order status codes -> our order_status. 1001 (pending pickup) and 3001 (on hold)
// cause no state change; unknown codes return null (logged, acknowledged, not retried).
export function spxToTarget(code: number): SpxTarget | null {
  if (code === 2001 || code === 2006) return "shipped"; // in transit / delivering
  if (code === 4001) return "delivered";
  if ((code >= 5001 && code <= 5003) || (code >= 6001 && code <= 6003) || code === 7001) {
    return "delivery_failed"; // pickup failed/damaged/lost, returning/return failed/returned, cancelled at SPX
  }
  return null;
}

// 6001–6003: the parcel comes back after failed delivery — the customer's refusal. 5001–5003 and
// 7001 (pickup failed, damaged, lost, pickup cancelled) are SPX-side and don't count against them.
export function isCustomerRefusal(code: number) {
  return code >= 6001 && code <= 6003;
}

// A manual Đã giao / Giao thất bại on an order with an SPX shipment is allowed only when SPX already
// says so: both are terminal, so a wrong click could never be corrected by a later callback.
export function spxConfirms(target: "delivered" | "delivery_failed", code: number) {
  return target === "delivered" ? code === 4001 : isCustomerRefusal(code);
}

// Forward-only paths; transition_order_status() allows a single step at a time and throws on
// anything else, so the route walks these one step at a time and stops on the first error.
export const WEBHOOK_PATHS: Record<SpxTarget, string[]> = {
  shipped: ["pending", "confirmed", "shipped"],
  delivered: ["pending", "confirmed", "shipped", "delivered"],
  delivery_failed: ["pending", "confirmed", "shipped", "delivery_failed"],
};

// Steps still needed to reach `target` from `current`. Empty = already there, past it, or in a
// terminal state (cancelled/delivery_failed) — never move backwards.
export function stepsTo(current: string, target: SpxTarget): string[] {
  const path = WEBHOOK_PATHS[target];
  const idx = path.indexOf(current);
  if (idx === -1 || idx === path.length - 1) return [];
  return path.slice(idx + 1);
}

export type SpxUpdate = { trackingNo: string; statusCode: number };

// Defensive: SPX may send one object or a batch under orders/data/list/items, with snake_case
// or camelCase fields.
function asUpdate(value: unknown): SpxUpdate | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  const trackingNo = ["tracking_no", "trackingNo", "tracking_number", "trackingNumber"]
    .map((k) => r[k])
    .find((v) => typeof v === "string" && v.length > 0) as string | undefined;
  const rawStatus = ["order_status", "orderStatus", "status", "status_code", "statusCode"]
    .map((k) => r[k])
    .find((v) => typeof v === "number" || (typeof v === "string" && /^\d+$/.test(v)));
  const statusCode = typeof rawStatus === "number" ? rawStatus : rawStatus == null ? NaN : Number(rawStatus);
  if (!trackingNo || !Number.isFinite(statusCode)) return null;
  return { trackingNo, statusCode: Math.trunc(statusCode) };
}

export function extractUpdates(json: unknown): SpxUpdate[] {
  const out: SpxUpdate[] = [];
  const push = (v: unknown) => {
    const u = asUpdate(v);
    if (u) out.push(u);
  };
  if (Array.isArray(json)) {
    json.forEach(push);
    return out;
  }
  if (json && typeof json === "object") {
    const r = json as Record<string, unknown>;
    push(r);
    for (const key of ["orders", "data", "list", "items"]) {
      const v = r[key];
      if (Array.isArray(v)) v.forEach(push);
      else if (v && typeof v === "object") push(v);
    }
  }
  return out;
}
