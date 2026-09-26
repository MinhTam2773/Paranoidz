// Runtime smoke test for the order migrations' money/stock/security logic.
// Run: pnpm --filter @paranoidz/db smoke   (needs apps/admin/.env.local)
//
// place_order() is service-role only (guest checkout, 20260926000001), so orders go through
// the admin client exactly like the storefront order route, with p_user_id for account orders.
// Customer sessions (admin magic-link → verifyOtp) are only used to prove what a browser
// can't do. Every per-customer rule is keyed on the normalized phone; test phones are
// 0900000001-0900000009. Cleans up after itself; the only permanent trace is order_number_seq gaps.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/types.ts";

type Db = SupabaseClient<Database>;
type Placed = { order_id: string; order_number: string; subtotal: number; discount: number; total: number };

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing from apps/admin/.env.local");

const noPersist = { auth: { persistSession: false, autoRefreshToken: false } };
const admin: Db = createClient<Database>(url, secret, noPersist);

const CUSTOMERS = ["customer1@paranoidz.test", "customer3@paranoidz.test"];
const VOUCHER = "SMOKE-TEST";
const PHONES = Array.from({ length: 9 }, (_, i) => `090000000${i + 1}`);

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

async function signInAs(email: string): Promise<Db> {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  const user = createClient<Database>(url, publishable, noPersist);
  const { error: otpError } = await user.auth.verifyOtp({
    type: "magiclink",
    token_hash: data.properties.hashed_token,
  });
  if (otpError) throw otpError;
  return user;
}

async function variant(id: string) {
  const { data, error } = await admin
    .from("product_variants").select("id, stock, color").eq("id", id).single();
  if (error) throw error;
  return data;
}

const createdOrders: string[] = [];
const deliveredItems: { variant_id: string; qty: number }[] = [];
let autoUsedBefore: number | null = null;

async function placeOrder(
  items: { variant_id: string; qty: number }[],
  opts: { phone?: string; voucher?: string; userId?: string; db?: Db } = {},
) {
  const res = await (opts.db ?? admin).rpc("place_order", {
    p_items: items,
    p_recipient_name: "Smoke Test",
    p_phone: opts.phone ?? PHONES[0],
    p_address: "1 Test St",
    p_city: "TP. Hồ Chí Minh",
    p_voucher_code: opts.voucher,
    p_user_id: opts.userId,
  });
  if (res.data) createdOrders.push((res.data as Placed).order_id);
  return res as { data: Placed | null; error: { message: string } | null };
}

async function transition(orderId: string, ...statuses: Database["public"]["Enums"]["order_status"][]) {
  for (const s of statuses) {
    const { error } = await admin.rpc("transition_order_status", { p_order_id: orderId, p_new_status: s });
    if (error) throw error;
  }
}

async function customer(phone: string) {
  const { data } = await admin.from("customers").select("*").eq("phone", phone).maybeSingle();
  return data;
}

async function main() {
  const [c1, c3] = await Promise.all(CUSTOMERS.map(signInAs));
  const c1Id = (await c1.auth.getUser()).data.user!.id;

  const { data: auto } = await admin.from("vouchers").select("used_count").eq("type", "auto_first5").single();
  autoUsedBefore = auto?.used_count ?? null;

  // Pick in-stock variants so the test doesn't depend on the seed's random stock.
  // ~13 single units are held at once below, so spread them over three variants.
  const { data: pool } = await admin
    .from("product_variants").select("id, stock").gte("stock", 8).order("stock", { ascending: false }).limit(4);
  if (!pool || pool.length < 4) throw new Error("need 4 variants with stock >= 8");
  let n = 0;
  const one = () => [{ variant_id: pool[1 + (n++ % 3)].id, qty: 1 }];

  // 1. Voucher max_uses under concurrent redemption ------------------------
  // 50% beats the 10% auto-first5, so place_order must pick the promo.
  await admin.from("vouchers").delete().eq("code", VOUCHER);
  const { data: v, error: vErr } = await admin.from("vouchers")
    .insert({ code: VOUCHER, type: "promo", discount_pct: 50, max_uses: 1 })
    .select("id").single();
  if (vErr) throw vErr;

  const racer = await variant(pool[0].id);
  const results = await Promise.all(
    [PHONES[0], PHONES[1], PHONES[2]].map((phone) =>
      placeOrder([{ variant_id: racer.id, qty: 1 }], { phone, voucher: VOUCHER })),
  );
  const { data: vAfter } = await admin.from("vouchers").select("used_count").eq("id", v.id).single();
  const { count: uses } = await admin.from("voucher_uses")
    .select("*", { count: "exact", head: true }).eq("voucher_id", v.id);
  const wins = results.filter((r) => !r.error).length;
  check("voucher max_uses=1: exactly one of 3 concurrent orders redeems", wins === 1 && uses === 1 && vAfter?.used_count === 1,
    `successes=${wins} voucher_uses=${uses} used_count=${vAfter?.used_count} errors=${results.map((r) => r.error?.message).filter(Boolean).join(" | ")}`);
  const racerAfter = await variant(pool[0].id);
  check("losing orders rolled back their stock decrement", racerAfter.stock === racer.stock - wins,
    `before=${racer.stock} after=${racerAfter.stock}`);

  // 2. Stock restore when one order holds two rows for the same variant ----
  const dup = await variant(pool[1].id);
  const { data: dupOrder, error: dupErr } = await placeOrder(
    [{ variant_id: dup.id, qty: 1 }, { variant_id: dup.id, qty: 2 }], { phone: PHONES[3] });
  if (dupErr) throw dupErr;
  check("duplicate-variant order decrements 3", (await variant(pool[1].id)).stock === dup.stock - 3);
  await transition(dupOrder!.order_id, "cancelled");
  const dupRestored = await variant(pool[1].id);
  check("cancel restores all 3 units", dupRestored.stock === dup.stock,
    `before=${dup.stock} after-cancel=${dupRestored.stock}`);

  // 3. Image snapshot picks the exact colourway ----------------------------
  const { data: colourway } = await admin.from("product_variants")
    .select("id, color, products!inner(slug)").gt("stock", 0)
    .eq("products.slug", "paranoid-logo-tee").eq("color", "White").limit(1).single();
  if (!colourway) throw new Error("no in-stock White paranoid-logo-tee variant");
  const { data: imgOrder, error: imgErr } = await placeOrder([{ variant_id: colourway.id, qty: 1 }], { phone: PHONES[3] });
  if (imgErr) throw imgErr;
  const { data: item } = await admin.from("order_items")
    .select("image_snapshot").eq("order_id", imgOrder!.order_id).single();
  check("image snapshot = White colourway, not general image",
    item?.image_snapshot === "products/paranoid-logo-tee/white-1.jpg", `got ${item?.image_snapshot}`);

  // 4. Customer cannot set is_admin on their own profile -------------------
  const { error: escalate } = await c3.from("profiles").update({ is_admin: true }).eq("id", (await c3.auth.getUser()).data.user!.id);
  const { data: prof } = await admin.from("profiles").select("is_admin").eq("id", (await c3.auth.getUser()).data.user!.id).single();
  check("is_admin self-update is rejected", !!escalate && prof?.is_admin === false,
    `error=${escalate?.message} is_admin=${prof?.is_admin}`);
  const { error: nameErr } = await c3.from("profiles")
    .update({ full_name: "Lê Minh Châu" }).eq("id", (await c3.auth.getUser()).data.user!.id);
  check("full_name self-update still allowed", !nameErr, nameErr?.message);

  // 5. Browsers can't call place_order at all (anon or signed in) ----------
  const anon = createClient<Database>(url, publishable, noPersist);
  const [anonTry, userTry] = await Promise.all([
    placeOrder(one(), { phone: PHONES[4], db: anon }),
    placeOrder(one(), { phone: PHONES[4], db: c3 }),
  ]);
  check("place_order denied to anon and signed-in browsers", !!anonTry.error && !!userTry.error,
    `anon=${anonTry.error?.message} user=${userTry.error?.message}`);

  // 6. Guest order + phone normalization -----------------------------------
  const { data: guest, error: guestErr } = await placeOrder(one(), { phone: "+84 90 000 0005" });
  const { data: guestRow } = await admin.from("orders").select("user_id, phone").eq("id", guest?.order_id ?? "").maybeSingle();
  check("guest order: user_id null, phone stored normalized, customer row created",
    !guestErr && guestRow?.user_id === null && guestRow?.phone === PHONES[4] && !!(await customer(PHONES[4])),
    `err=${guestErr?.message} row=${JSON.stringify(guestRow)}`);
  const bad = await placeOrder(one(), { phone: "12345" });
  check("invalid phone rejected", bad.error?.message === "INVALID_PHONE", bad.error?.message);

  // 7. First-5 voucher counts orders by phone, across guest and account ----
  // PHONES[5]: 5 orders get 10%, the 6th — placed while signed in — gets nothing.
  const discounts: number[] = [];
  for (let i = 0; i < 6; i++) {
    const r = await placeOrder(one(), { phone: PHONES[5], userId: i === 5 ? c1Id : undefined });
    if (r.error) throw new Error(`first-5 order ${i + 1}: ${r.error.message}`);
    discounts.push(r.data!.discount);
    await transition(r.data!.order_id, "confirmed"); // stay under the pending limit
  }
  check("first-5 by phone: orders 1-5 discounted, 6th (signed in, same phone) not",
    discounts.slice(0, 5).every((d) => d > 0) && discounts[5] === 0, `discounts=${discounts.join(",")}`);

  // 8. Promo once per phone, even when switching guest → account ----------
  await admin.from("vouchers").update({ max_uses: null, used_count: 0 }).eq("id", v.id);
  const promo1 = await placeOrder(one(), { phone: PHONES[6], voucher: VOUCHER });
  const promo2 = await placeOrder(one(), { phone: "090 000 0007", voucher: VOUCHER, userId: c1Id });
  check("promo once per phone (2nd try, other format + signed in, refused)",
    !promo1.error && promo2.error?.message === "VOUCHER_ALREADY_USED", `1st=${promo1.error?.message ?? "ok"} 2nd=${promo2.error?.message}`);

  // 9. Blacklist is per phone, whatever the format -------------------------
  await admin.from("customers").upsert({ phone: PHONES[7], is_blacklisted: true });
  const bl = await placeOrder(one(), { phone: "+84900000008", userId: c1Id });
  check("blacklisted phone refused (+84 format, signed in)", bl.error?.message === "BLACKLISTED", bl.error?.message);

  // 10. Abuse limits --------------------------------------------------------
  const pend = [];
  for (let i = 0; i < 4; i++) pend.push(await placeOrder(one(), { phone: PHONES[8] }));
  check("4th open pending order for one phone refused",
    pend.slice(0, 3).every((r) => !r.error) && pend[3].error?.message === "TOO_MANY_PENDING", pend.map((r) => r.error?.message ?? "ok").join(","));
  const big = await placeOrder([{ variant_id: pool[1].id, qty: 21 }], { phone: PHONES[4] });
  check("21 units in one order refused", big.error?.message === "TOO_MANY_ITEMS", big.error?.message);

  // 11. Delivered / refused counters land on the phone ---------------------
  const dItems = one();
  const d = await placeOrder(dItems, { phone: PHONES[4] });
  await transition(d.data!.order_id, "confirmed", "shipped", "delivered");
  deliveredItems.push(...dItems);
  const f = await placeOrder(one(), { phone: PHONES[4] });
  await transition(f.data!.order_id, "confirmed", "shipped", "delivery_failed");
  const c = await customer(PHONES[4]);
  check("delivered_count and refusal_count increment on the customer (phone)",
    c?.delivered_count === 1 && c?.refusal_count === 1, JSON.stringify(c));

  // 12. Order rate limit: 5 attempts / hour per phone, 10 per IP (IPv6 per /64) ---
  // Test IPs are documentation ranges (192.0.2.0/24, 2001:db8::/32); '' = no IP.
  const hit = async (ip: string, phone: string) => {
    const { data, error } = await admin.rpc("hit_order_rate_limit", { p_ip: ip, p_phone: phone });
    if (error) throw error;
    return data;
  };
  const phoneHits = [];
  for (const p of ["0900000001", "+84 90 000 0001", "090.000.0001", "84900000001", "0900 000 001", "0900000001"]) {
    phoneHits.push(await hit("", p));
  }
  check("phone limit: 5 allowed, 6th refused, any format", phoneHits.join() === "true,true,true,true,true,false", phoneHits.join());
  check("other phone unaffected", await hit("", PHONES[1]));

  const ipHits = [];
  for (let i = 0; i < 11; i++) ipHits.push(await hit("192.0.2.1", ""));
  check("IPv4 limit: 10 allowed, 11th refused", ipHits.slice(0, 10).every(Boolean) && !ipHits[10], ipHits.join());
  check("other IPv4 unaffected", await hit("192.0.2.2", ""));
  const mapped = [await hit("::ffff:192.0.2.1", ""), await hit("::ffff:192.0.2.3", "")];
  check("IPv4-mapped IPv6 counts as its IPv4 address (not one shared ::/64)", mapped.join() === "false,true", mapped.join());

  const v6Hits = [];
  for (let i = 1; i <= 10; i++) v6Hits.push(await hit(`2001:db8:0:1::${i.toString(16)}`, ""));
  const sameSlash64 = await hit("2001:db8:0:1:ffff:ffff:ffff:ffff", "");
  const otherSlash64 = await hit("2001:db8:0:2::1", "");
  check("IPv6 counted per /64: 11th address in the /64 refused, next /64 allowed",
    v6Hits.every(Boolean) && !sameSlash64 && otherSlash64, `same=${sameSlash64} other=${otherSlash64}`);

  const { error: anonHit } = await anon.rpc("hit_order_rate_limit", { p_ip: "192.0.2.3", p_phone: "" });
  const { data: anonRows } = await anon.from("rate_limits").select("bucket");
  check("rate limit function + table closed to browsers", !!anonHit && (anonRows ?? []).length === 0,
    `rpc=${anonHit?.message} rows=${anonRows?.length}`);
}

async function cleanup() {
  // Cancel anything still cancellable so stock is restored, then delete test rows.
  for (const id of createdOrders) {
    const { data } = await admin.from("orders").select("status").eq("id", id).single();
    if (data?.status === "pending" || data?.status === "confirmed") {
      await admin.rpc("transition_order_status", { p_order_id: id, p_new_status: "cancelled" });
    }
  }
  // Delivered orders can't be cancelled: put their units back by hand.
  for (const { variant_id, qty } of deliveredItems) {
    const { stock } = await variant(variant_id);
    await admin.from("product_variants").update({ stock: stock + qty }).eq("id", variant_id);
  }
  if (createdOrders.length) await admin.from("orders").delete().in("id", createdOrders);
  await admin.from("customers").delete().in("phone", PHONES);
  await admin.from("rate_limits").delete().in("bucket", PHONES.map((p) => `phone:${p}`));
  await admin.from("rate_limits").delete().or("bucket.like.ip:192.0.2.%,bucket.like.ip:2001:db8:%");
  await admin.from("vouchers").delete().eq("code", VOUCHER);
  // The delivered test order kept its AUTO-FIRST5 use; put the counter back.
  if (autoUsedBefore !== null) await admin.from("vouchers").update({ used_count: autoUsedBefore }).eq("type", "auto_first5");
  const { data: left } = await admin.from("vouchers").select("code, used_count").eq("type", "auto_first5");
  console.log(`cleanup: removed ${createdOrders.length} test orders; auto voucher ${JSON.stringify(left)}`);
}

try {
  await main();
} finally {
  await cleanup();
}
console.log(failures ? `\n${failures} check(s) FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
