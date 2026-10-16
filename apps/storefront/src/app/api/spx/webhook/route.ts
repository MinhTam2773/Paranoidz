import { after } from "next/server";
import { createAdminClient } from "@paranoidz/db/admin";
import { checkSign } from "@paranoidz/db/spx/sign";
import { extractUpdates, spxToTarget, stepsTo, type SpxTarget, type SpxUpdate } from "@paranoidz/db/spx/webhook";
import type { Database } from "@paranoidz/db/types";

type OrderStatus = Database["public"]["Enums"]["order_status"];

// SPX tracking webhook, per §4.1 "Tracking Web Hook" of the SPX Open Platform integration guide
// (verified against the official docs 2026-10-16):
//
//   https://paranoidz.vn/api/spx/webhook
//
// (The plan sketched this in the admin app, but the shop's own domain is the stable public URL,
// so it lives in the storefront. The storefront already holds every SPX_* env var for the live
// fee quote, and the service-role client bypasses RLS for the status write.)
//
// What SPX sends: HTTP POST, one flat JSON object per callback (no batch wrapper). Fields include
// status (string), status_code (STRING, e.g. "2001"), message, tracking_no, order_id (OUR order
// number — it is SPX's order_id), timestamp, id, latest_shipping_fee, ... Authentication: SPX
// signs with the same check-sign scheme as our API calls — headers `app-id` / `timestamp` (s) /
// `random-num` (int64) / `check-sign` = hex HMAC-SHA256(app-secret,
// "<app-id>_<timestamp>_<random-num>_<body>") over the exact raw body. To regenerate the
// signature we need all three values, so they must arrive as headers; unsigned or mis-signed
// requests are rejected with 401 and never touch the database.
//
// Timing (docs §4.1): SPX applies a 3-second timeout and recommends returning 200 immediately
// upon receipt, BEFORE processing — repeated timeouts make SPX stop pushing. So this handler
// only verifies + parses synchronously; all database work runs in after().
// Expected response: HTTP 200 (no prescribed body).
//
// Status mapping (§4.1 appendix): 2001/2006 (in transit/delivering) -> shipped, 4001 ->
// delivered, 5001-5003 (pickup failed/damaged/lost), 6001-6003 (returning/return failed/
// returned) and 7001 (pickup request cancelled) -> delivery_failed. 1001/3001/unknown are
// logged and ignored. Every move goes through transition_order_status(), so stock, vouchers
// and loyalty stay consistent; the walk is idempotent (an order already at or past the target
// is left alone). Unknown tracking numbers are logged and acknowledged — SPX must not retry
// forever over a test order we deleted. Pure mapping/parsing lives in @paranoidz/db/spx/webhook
// (unit-tested).

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
      // the next callback or a reload will show the truth.
      console.error("spx webhook: transition failed", { orderId, from: current, to: next, error: error.message });
      break;
    }
    moved = true;
    current = next;
  }
  return moved ? "moved" : "noop";
}

async function processUpdates(updates: SpxUpdate[]): Promise<void> {
  const client = createAdminClient();
  for (const u of updates) {
    const target = spxToTarget(u.statusCode);
    if (!target) {
      console.log("spx webhook: unmapped status", u);
      continue;
    }
    // order_id in the callback is our order_number (it is SPX's order_id).
    const byTracking = await client.from("orders").select("id, status, order_number").eq("spx_tracking_no", u.trackingNo).maybeSingle();
    const order =
      byTracking.data ??
      (await client.from("orders").select("id, status, order_number").eq("order_number", u.trackingNo).maybeSingle()).data;
    if (!order) {
      console.error("spx webhook: order not found", u.trackingNo);
      continue;
    }
    const outcome = await advanceTo(client, order.id, order.status, target, `SPX webhook: ${u.statusCode} → ${target}`);
    console.log("spx webhook: processed", { tracking_no: u.trackingNo, order: order.order_number, from: order.status, to: target, outcome });
  }
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
  const updates = extractUpdates(json);
  // 200 now, work after the response: SPX times out in 3 s and stops pushing on repeats.
  after(() => processUpdates(updates).catch((e) => console.error("spx webhook: processing failed", e)));
  return Response.json({ ret_code: 0, message: "ok" });
}
