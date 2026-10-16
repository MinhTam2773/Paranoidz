import { createAdminClient } from "@paranoidz/db/admin";
import { checkSign } from "@paranoidz/db/spx/sign";
import { extractUpdates, spxToTarget, stepsTo, type SpxTarget } from "@paranoidz/db/spx/webhook";
import type { Database } from "@paranoidz/db/types";

type OrderStatus = Database["public"]["Enums"]["order_status"];

// SPX tracking webhook (ARCHITECTURE.md §5 "SPX Open API", phase 3): SPX POSTs order status
// updates to the URL registered with them:
//
//   https://paranoidz.vn/api/spx/webhook
//
// (The plan sketched this in the admin app, but the shop's own domain is the stable public URL,
// so it lives in the storefront. The storefront already holds every SPX_* env var for the live
// fee quote, and the service-role client bypasses RLS for the status write.)
//
// Authentication: SPX signs the callback with the same check-sign scheme as our API calls —
// headers `app-id` / `timestamp` (s) / `random-num` (int64) / `check-sign` =
// hex HMAC-SHA256(app-secret, "<app-id>_<timestamp>_<random-num>_<body>") over the exact raw
// body. Unsigned or mis-signed requests are rejected with 401 and never touch the database.
//
// Every move goes through transition_order_status(), so stock, vouchers and loyalty stay
// consistent; the walk is idempotent (an order already at or past the target is left alone).
// Unknown tracking numbers are logged and acknowledged — SPX must not retry forever over a
// test order we deleted. Pure mapping/parsing lives in @paranoidz/db/spx/webhook (unit-tested).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 256 * 1024;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function verifySignature(req: Request, rawBody: string): boolean {
  const appId = Number(process.env.SPX_APP_ID);
  const secret = process.env.SPX_APP_SECRET;
  const headerAppId = Number(req.headers.get("app-id"));
  const timestamp = Number(req.headers.get("timestamp"));
  const randomRaw = req.headers.get("random-num");
  const sent = req.headers.get("check-sign");
  if (!secret || !Number.isSafeInteger(appId) || headerAppId !== appId || !sent || !randomRaw || !Number.isFinite(timestamp)) {
    return false;
  }
  let random: bigint;
  try {
    random = BigInt(randomRaw);
  } catch {
    return false;
  }
  return timingSafeEqual(sent, checkSign(appId, secret, timestamp, random, rawBody));
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function advanceTo(client: AdminClient, orderId: string, current: string, target: SpxTarget, note: string): Promise<"moved" | "noop"> {
  let moved = false;
  for (const next of stepsTo(current, target)) {
    const { error } = await client.rpc("transition_order_status", {
      p_order_id: orderId,
      p_new_status: next as OrderStatus,
      p_note: note,
    });
    if (error) {
      // A concurrent move (admin click, another callback) changed the state underneath us;
      // the next callback or a reload will show the truth. Never throw: SPX must get its 200.
      console.error("spx webhook: transition failed", { orderId, from: current, to: next, error: error.message });
      break;
    }
    moved = true;
    current = next;
  }
  return moved ? "moved" : "noop";
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return Response.json({ ret_code: 1, message: "body too large" }, { status: 413 });
  }
  if (!verifySignature(req, raw)) {
    console.error("spx webhook: bad signature");
    return Response.json({ ret_code: 1, message: "bad signature" }, { status: 401 });
  }
  let json: unknown;
  try {
    json = raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return Response.json({ ret_code: 1, message: "bad json" }, { status: 400 });
  }

  const client = createAdminClient();
  const results: Record<string, unknown>[] = [];
  for (const u of extractUpdates(json)) {
    const target = spxToTarget(u.statusCode);
    if (!target) {
      console.log("spx webhook: unmapped status", u);
      results.push({ tracking_no: u.trackingNo, skipped: "unmapped_status" });
      continue;
    }
    // Our order_number is SPX's order_id, so it works as a fallback lookup.
    const byTracking = await client.from("orders").select("id, status, order_number").eq("spx_tracking_no", u.trackingNo).maybeSingle();
    const order =
      byTracking.data ??
      (await client.from("orders").select("id, status, order_number").eq("order_number", u.trackingNo).maybeSingle()).data;
    if (!order) {
      console.error("spx webhook: order not found", u.trackingNo);
      results.push({ tracking_no: u.trackingNo, skipped: "order_not_found" });
      continue;
    }
    const outcome = await advanceTo(client, order.id, order.status, target, `SPX webhook: ${u.statusCode} → ${target}`);
    results.push({ tracking_no: u.trackingNo, order: order.order_number, from: order.status, to: target, outcome });
  }
  return Response.json({ ret_code: 0, message: "ok", results });
}
