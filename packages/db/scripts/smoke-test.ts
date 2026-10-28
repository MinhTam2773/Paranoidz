// Runtime smoke test for the order migrations' money/stock/security logic.
// Run: pnpm --filter @paranoidz/db smoke   (needs apps/admin/.env.local)
//
// place_order() is service-role only (guest checkout, 20260926000001), so orders go through
// the admin client exactly like the storefront order route, with p_user_id for account orders.
// Customer sessions (admin magic-link → verifyOtp) are only used to prove what a browser
// can't do. Every per-customer rule is keyed on the normalized phone; test phones are
// 0900000001-0900000011. Cleans up after itself; the only permanent trace is order_number_seq gaps.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/types.ts";

type Db = SupabaseClient<Database>;
type Placed = { order_id: string; order_number: string; subtotal: number; discount: number; shipping_fee: number; shipping_discount: number; total: number; gift_qty: number; gift_missing: boolean; gacha_redeemed: boolean };

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing from apps/admin/.env.local");

const noPersist = { auth: { persistSession: false, autoRefreshToken: false } };
const admin: Db = createClient<Database>(url, secret, noPersist);

const CUSTOMERS = ["customer1@paranoidz.test", "customer3@paranoidz.test"];
const VOUCHER = "SMOKE-TEST";
const BUNDLE_VOUCHER = "SMOKE-TEST-BUNDLE";
const QUOTE_VOUCHER = "SMOKE-TEST-QUOTE";
const BUNDLE_PREFIX = "SMOKE-BUNDLE"; // assumes no other active bundle holds the products picked in case 12
const PHONES = Array.from({ length: 9 }, (_, i) => `090000000${i + 1}`);
const QUOTE_PHONE = "0900000010"; // case 17's promo order: no history from earlier cases
const FEE_PHONE = "0900000011"; // case 19: up to 3 pending orders of its own
const LOST_PHONE = "0900000012"; // case 20: refusal count from this case only
const DELIVERY_PHONE = "0900000013"; // case 21: up to 2 pending orders of its own
const V2_PHONE = "0900000014"; // case 23: pricing v2 rules, every order confirmed at once
const AUTH_EMAILS = [1, 2, 3].map((i) => `smoke-auth-${i}@paranoidz.test`);

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
const createdUsers: string[] = [];
const deliveredItems: { variant_id: string; qty: number }[] = [];
let autoUsedBefore: number | null = null;
let welcomeUsedBefore: number | null = null; // PDZWELCOME (pricing v2), restored by cleanup
let giftVariant: string | null = null; // case 23 flags one variant as the order gift
let flashTestWindow: { id: string; prev: { duration_minutes: number; discount_percent: number } | null } | null = null;
// Flash sale windows switched off for the run (their extra discount depends on the clock).
let flashWindows: string[] = [];
const cartUsers: string[] = [];
const reviewUsers: string[] = [];

async function placeOrder(
  items: { variant_id: string; qty: number }[],
  opts: { phone?: string; voucher?: string; vouchers?: string[]; userId?: string; db?: Db; city?: string; shippingFee?: number; spxVoucher?: string; deliveryMethod?: string; expectedTotal?: number; gachaCode?: string } = {},
) {
  const res = await (opts.db ?? admin).rpc("place_order", {
    p_items: items,
    p_recipient_name: "Smoke Test",
    p_phone: opts.phone ?? PHONES[0],
    p_address: "1 Test St",
    p_city: opts.city ?? "TP. Hồ Chí Minh",
    p_voucher_codes: opts.vouchers ?? (opts.voucher ? [opts.voucher] : undefined),
    p_user_id: opts.userId,
    p_shipping_fee: opts.shippingFee,
    p_spx_voucher: opts.spxVoucher,
    p_delivery_method: opts.deliveryMethod,
    p_expected_total: opts.expectedTotal,
    p_gacha_code: opts.gachaCode,
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
  const { data: flash, error: flashError } = await admin.from("flash_sale_windows").select("id").eq("enabled", true);
  if (flashError) throw flashError;
  flashWindows = flash.map((w) => w.id);
  if (flashWindows.length) await admin.from("flash_sale_windows").update({ enabled: false }).in("id", flashWindows);

  const [c1, c3] = await Promise.all(CUSTOMERS.map(signInAs));
  const c1Id = (await c1.auth.getUser()).data.user!.id;

  const { data: auto } = await admin.from("vouchers").select("used_count").eq("type", "auto_first5").single();
  autoUsedBefore = auto?.used_count ?? null;
  const { data: welcome } = await admin.from("vouchers").select("used_count").eq("code", "PDZWELCOME").single();
  welcomeUsedBefore = welcome?.used_count ?? null;

  // Pick in-stock variants so the test doesn't depend on the seed's random stock.
  // ~13 single units are held at once below, so spread them over three variants.
  const { data: pool } = await admin
    .from("product_variants").select("id, stock").gte("stock", 8).order("stock", { ascending: false }).limit(4);
  if (!pool || pool.length < 4) throw new Error("need 4 variants with stock >= 8");
  let n = 0;
  const one = () => [{ variant_id: pool[1 + (n++ % 3)].id, qty: 1 }];
  // One 50% promo, max_uses 1: the atomic used_count guard lets exactly one order through.
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

  // 7. "Khách mua lần đầu" (PDZWELCOME, 'standing'): 10% on every order, no per-phone limit (pricing v2).
  // PHONES[5]: 6 orders, the 6th signed in, all get it; without the code there's no automatic discount.
  const discounts: number[] = [];
  for (let i = 0; i < 6; i++) {
    const r = await placeOrder(one(), { phone: PHONES[5], userId: i === 5 ? c1Id : undefined, voucher: "pdzwelcome" });
    if (r.error) throw new Error(`lần đầu order ${i + 1}: ${r.error.message}`);
    discounts.push(r.data!.discount === Math.floor(r.data!.subtotal * 0.1) ? 1 : 0);
    await transition(r.data!.order_id, "confirmed"); // stay under the pending limit
  }
  const noCode = await placeOrder(one(), { phone: PHONES[5] });
  check("lần đầu: PDZWELCOME takes 10% on all 6 orders of one phone; no code → no discount (AUTO-FIRST5 retired)",
    discounts.every((d) => d === 1) && noCode.data?.discount === 0, `ok=${discounts.join(",")} noCode=${noCode.data?.discount ?? noCode.error?.message}`);

  // 8. Promo once per phone, even when switching guest → account ----------
  await admin.from("vouchers").update({ max_uses: null, used_count: 0 }).eq("id", v.id);
  const promo1 = await placeOrder(one(), { phone: PHONES[6], voucher: VOUCHER });
  const promo2 = await placeOrder(one(), { phone: "090 000 0007", voucher: VOUCHER, userId: c1Id });
  check("promo once per phone (2nd try, other format + signed in, refused)",
    !promo1.error && promo2.error?.message === `VOUCHER_ALREADY_USED:${VOUCHER}`, `1st=${promo1.error?.message ?? "ok"} 2nd=${promo2.error?.message}`);

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

  // 12. Rate limit, with the storefront's order limits: 5 attempts / hour per phone, 10 per IP
  // (IPv6 per /64). Test IPs are documentation ranges (192.0.2.0/24, 2001:db8::/32); '' = no IP.
  const hit = async (ip: string, phone: string, scope = "order") => {
    const { data, error } = await admin.rpc("hit_rate_limit", { p_scope: scope, p_ip: ip, p_phone: phone, p_ip_limit: 10, p_phone_limit: 5 });
    if (error) throw error;
    return data;
  };
  const phoneHits = [];
  for (const p of ["0900000001", "+84 90 000 0001", "090.000.0001", "84900000001", "0900 000 001", "0900000001"]) {
    phoneHits.push(await hit("", p));
  }
  check("phone limit: 5 allowed, 6th refused, any format", phoneHits.join() === "true,true,true,true,true,false", phoneHits.join());
  check("other phone unaffected", await hit("", PHONES[1]));
  check("scopes are separate: exhausted order phone can still look up", await hit("", PHONES[0], "lookup"));

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

  const { error: anonHit } = await anon.rpc("hit_rate_limit", { p_scope: "order", p_ip: "192.0.2.3", p_phone: "", p_ip_limit: 99, p_phone_limit: 99 });
  const { data: anonRows } = await anon.from("rate_limits").select("bucket");
  check("rate limit function + table closed to browsers", !!anonHit && (anonRows ?? []).length === 0,
    `rpc=${anonHit?.message} rows=${anonRows?.length}`);

  // 9. Account phone: normalized + unique, never blocks a signup -----------
  const signUp = async (email: string, meta: Record<string, string>) => {
    const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: meta });
    if (error) throw error;
    createdUsers.push(data.user.id);
    return (await admin.from("profiles").select("full_name, phone").eq("id", data.user.id).single()).data;
  };
  const first = await signUp(AUTH_EMAILS[0], { full_name: "Smoke One", phone: "+84 90 000 0008" });
  check("signup metadata → profile name + normalized phone",
    first?.full_name === "Smoke One" && first?.phone === PHONES[7], JSON.stringify(first));
  const taken = await signUp(AUTH_EMAILS[1], { full_name: "Smoke Two", phone: "090.000.0008" });
  check("signup with a taken phone still creates the account, phone left empty",
    taken?.full_name === "Smoke Two" && taken?.phone === null, JSON.stringify(taken));
  const oauth = await signUp(AUTH_EMAILS[2], { name: "Smoke Oauth" });
  check("OAuth-style metadata (name, no phone) → full_name, phone empty",
    oauth?.full_name === "Smoke Oauth" && oauth?.phone === null, JSON.stringify(oauth));

  const two = await signInAs(AUTH_EMAILS[1]);
  const twoId = (await two.auth.getUser()).data.user!.id;
  const { error: takenErr } = await two.from("profiles").update({ phone: PHONES[7] }).eq("id", twoId);
  const { error: rawErr } = await two.from("profiles").update({ phone: "090 000 0009" }).eq("id", twoId);
  const { error: okErr } = await two.from("profiles").update({ phone: PHONES[8] }).eq("id", twoId);
  check("phone self-update: taken → 23505, unnormalized → 23514, free normalized → ok",
    takenErr?.code === "23505" && rawErr?.code === "23514" && !okErr, `${takenErr?.code} ${rawErr?.code} ${okErr?.message}`);

  // 10. Saved address link: only the owner's own address -----------------
  const c1Address = "a0000000-0000-4000-8000-000000000001"; // seed: customer1's default address
  const c3Id = (await c3.auth.getUser()).data.user!.id;
  const withAddress = async (userId: string | undefined, phone: string) => {
    const res = await admin.rpc("place_order", {
      p_items: one(), p_recipient_name: "Smoke Test", p_phone: phone, p_address: "1 Test St",
      p_city: "TP. Hồ Chí Minh", p_user_id: userId, p_address_id: c1Address,
    });
    if (res.data) createdOrders.push((res.data as Placed).order_id);
    return res as { data: Placed | null; error: { message: string } | null };
  };
  const [stolen, guestLink, own] = [await withAddress(c3Id, PHONES[5]), await withAddress(undefined, PHONES[5]), await withAddress(c1Id, PHONES[6])];
  const { data: linked } = await admin.from("orders").select("address_id").eq("id", own.data?.order_id ?? "").maybeSingle();
  check("p_address_id: other user's → INVALID_ADDRESS, guest → INVALID_ADDRESS, owner → linked",
    stolen.error?.message === "INVALID_ADDRESS" && guestLink.error?.message === "INVALID_ADDRESS" && linked?.address_id === c1Address,
    `${stolen.error?.message} ${guestLink.error?.message} ${linked?.address_id}`);

  // 11. Admin stock edit: compare-and-set, all or nothing ------------------
  const [sa, sb] = [await variant(pool[2].id), await variant(pool[3].id)];
  const stale = await admin.rpc("set_variant_stocks", { p_changes: [
    { variant_id: sa.id, expected: sa.stock, stock: sa.stock + 5 },
    { variant_id: sb.id, expected: sb.stock + 1, stock: 0 },
  ] });
  const afterStale = [(await variant(sa.id)).stock, (await variant(sb.id)).stock];
  check("set_variant_stocks: one stale expected → STOCK_CHANGED, nothing applied",
    stale.error?.message === "STOCK_CHANGED" && afterStale[0] === sa.stock && afterStale[1] === sb.stock,
    `${stale.error?.message} ${afterStale.join("/")}`);
  const ok = await admin.rpc("set_variant_stocks", { p_changes: [
    { variant_id: sa.id, expected: sa.stock, stock: sa.stock + 5 },
    { variant_id: sb.id, expected: sb.stock, stock: sb.stock + 1 },
  ] });
  const afterOk = [(await variant(sa.id)).stock, (await variant(sb.id)).stock];
  await admin.rpc("set_variant_stocks", { p_changes: [
    { variant_id: sa.id, expected: sa.stock + 5, stock: sa.stock },
    { variant_id: sb.id, expected: sb.stock + 1, stock: sb.stock },
  ] });
  check("set_variant_stocks: matching expected → applied", !ok.error && afterOk[0] === sa.stock + 5 && afterOk[1] === sb.stock + 1,
    `${ok.error?.message} ${afterOk.join("/")}`);
  const negative = await admin.rpc("set_variant_stocks", { p_changes: [{ variant_id: sa.id, expected: sa.stock, stock: -1 }] });
  const asCustomer = await c1.rpc("set_variant_stocks", { p_changes: [{ variant_id: sa.id, expected: sa.stock, stock: 99 }] });
  const asAnon = await createClient<Database>(url, publishable, noPersist)
    .rpc("set_variant_stocks", { p_changes: [{ variant_id: sa.id, expected: sa.stock, stock: 99 }] });
  check("set_variant_stocks: negative → INVALID_STOCK, customer → FORBIDDEN, anon denied",
    negative.error?.message === "INVALID_STOCK" && asCustomer.error?.message === "FORBIDDEN" && !!asAnon.error
      && (await variant(sa.id)).stock === sa.stock,
    `${negative.error?.message} ${asCustomer.error?.message} ${asAnon.error?.message}`);

  // 12. Bundle pricing (ARCHITECTURE.md §5) --------------------------------
  // Four products, ≥ ₫150.000 each, so any 2-product set is worth more than its discount.
  const { data: bv } = await admin.from("product_variants")
    .select("id, product_id, price, products!inner(is_active)").eq("products.is_active", true)
    .gte("stock", 5).gte("price", 150000).order("price");
  const firstPerProduct = new Map((bv ?? []).toReversed().map((v) => [v.product_id, v]));
  const [p1, p2, p3, p4] = [...firstPerProduct.values()];
  if (!p4) throw new Error("need 4 active products with a variant priced >= 150000 and stock >= 5");
  const bundle = async (name: string, amount: number, products: string[]) => {
    const { data, error } = await admin.from("bundles").insert({ name: `${BUNDLE_PREFIX} ${name}`, discount_amount: amount }).select("id").single();
    if (error) throw error;
    const { error: itemsErr } = await admin.from("bundle_items").insert(products.map((product_id) => ({ bundle_id: data.id, product_id })));
    if (itemsErr) throw itemsErr;
  };
  await bundle("A", 300000, [p1.product_id, p2.product_id]);
  await bundle("B", 200000, [p1.product_id, p3.product_id]);
  await bundle("C", 200000, [p2.product_id, p4.product_id]);
  const applied = async (orderId: string) => {
    const [{ data: o }, { count }] = await Promise.all([
      admin.from("orders").select("discount, applied_bundles").eq("id", orderId).single(),
      admin.from("voucher_uses").select("*", { count: "exact", head: true }).eq("order_id", orderId),
    ]);
    const sets = ((o?.applied_bundles ?? []) as { name: string; sets: number }[]).map((b) => `${b.name.slice(BUNDLE_PREFIX.length + 1)}×${b.sets}`).sort().join(",");
    return { discount: o?.discount, sets, voucherUses: count };
  };

  // One of each: greedy would take A (300k) and strand p3/p4; B + C = 400k is better.
  const all = await placeOrder([p1, p2, p3, p4].map((v) => ({ variant_id: v.id, qty: 1 })), { phone: PHONES[4] });
  if (all.error) throw all.error;
  const allRes = await applied(all.data!.order_id);
  check("bundles: overlap resolves to the best combination (B+C, not A), no voucher use",
    allRes.discount === 400000 && allRes.sets === "B×1,C×1" && allRes.voucherUses === 0, JSON.stringify(allRes));

  // Two complete B sets → discount ×2.
  const twice = await placeOrder([{ variant_id: p1.id, qty: 2 }, { variant_id: p3.id, qty: 2 }], { phone: PHONES[4] });
  if (twice.error) throw twice.error;
  const twiceRes = await applied(twice.data!.order_id);
  check("bundles: per complete set (2 × B = 400k)", twiceRes.discount === 400000 && twiceRes.sets === "B×2", JSON.stringify(twiceRes));

  // Pricing v2: combo first, then the promo on what's left (they stack). 100% → the rest is free;
  // capped at ₫1.000 → combo + ₫1.000. Both orders consume the code.
  await admin.from("vouchers").delete().eq("code", BUNDLE_VOUCHER);
  const { data: bVoucher, error: bvErr } = await admin.from("vouchers")
    .insert({ code: BUNDLE_VOUCHER, type: "promo", discount_pct: 100 }).select("id").single();
  if (bvErr) throw bvErr;
  const pair = [{ variant_id: p1.id, qty: 1 }, { variant_id: p3.id, qty: 1 }];
  const promoWins = await placeOrder(pair, { phone: PHONES[5], voucher: BUNDLE_VOUCHER });
  if (promoWins.error) throw promoWins.error;
  const promoRes = await applied(promoWins.data!.order_id);
  await admin.from("vouchers").update({ cap_amount: 1000 }).eq("id", bVoucher.id);
  const bundleWins = await placeOrder(pair, { phone: PHONES[6], voucher: BUNDLE_VOUCHER.toLowerCase() });
  if (bundleWins.error) throw bundleWins.error;
  const bundleRes = await applied(bundleWins.data!.order_id);
  const { data: bvAfter } = await admin.from("vouchers").select("used_count").eq("id", bVoucher.id).single();
  check("bundles + promo stack: combo first, promo on the rest (100% → free; cap ₫1.000 → combo + 1.000), both uses counted",
    promoRes.discount === promoWins.data!.subtotal && promoRes.sets === "B×1" && promoRes.voucherUses === 1
      && bundleRes.discount === 201000 && bundleRes.sets === "B×1" && bundleRes.voucherUses === 1 && bvAfter?.used_count === 2,
    `promo ${JSON.stringify(promoRes)} bundle ${JSON.stringify(bundleRes)} used_count=${bvAfter?.used_count}`);

  // 13. Account cart: merge sums + caps at stock, own rows only ------------
  cartUsers.push(c1Id, c3Id);
  await admin.from("cart_items").delete().in("user_id", cartUsers);
  const cartVariant = await variant(pool[0].id); // current stock — case 11 changed it
  const merged = await c1.rpc("merge_cart", {
    p_lines: [
      { variant_id: cartVariant.id, qty: 2 },
      { variant_id: cartVariant.id, qty: 1 },
      { variant_id: "not-a-uuid", qty: 1 },
      { variant_id: crypto.randomUUID(), qty: 1 },
    ],
  });
  const { data: afterMerge } = await c1.from("cart_items").select("variant_id, qty");
  check("cart: merge sums duplicates, skips malformed / unknown ids",
    !merged.error && afterMerge?.length === 1 && afterMerge[0].qty === 3, JSON.stringify(merged.error ?? afterMerge));
  await c1.rpc("merge_cart", { p_lines: [{ variant_id: cartVariant.id, qty: cartVariant.stock }] });
  const { data: capped } = await c1.from("cart_items").select("qty").eq("variant_id", cartVariant.id).single();
  check("cart: merge into an existing row caps at stock", capped?.qty === cartVariant.stock, `${capped?.qty} / ${cartVariant.stock}`);

  const anonDb = createClient<Database>(url, publishable, noPersist);
  const [otherRead, otherInsert, otherUpdate, anonRead, anonMerge] = await Promise.all([
    c3.from("cart_items").select("qty"),
    c3.from("cart_items").insert({ user_id: c1Id, variant_id: pool[1].id, qty: 1 }),
    c3.from("cart_items").update({ qty: 1 }).eq("user_id", c1Id).select(),
    anonDb.from("cart_items").select("qty"),
    anonDb.rpc("merge_cart", { p_lines: [{ variant_id: cartVariant.id, qty: 1 }] }),
  ]);
  const { data: untouched } = await admin.from("cart_items").select("qty").eq("user_id", c1Id);
  check("cart: another user / anon can't read or write it",
    otherRead.data?.length === 0 && !!otherInsert.error && otherUpdate.data?.length === 0
      && anonRead.data?.length === 0 && !!anonMerge.error && untouched?.length === 1 && untouched[0].qty === cartVariant.stock,
    `read=${otherRead.data?.length} insert=${otherInsert.error?.code} update=${otherUpdate.data?.length} anonRead=${anonRead.data?.length} anonMerge=${anonMerge.error?.code}`);

  // 14. Reviews: delivered buyers only, unforgeable author / brand flag ------
  reviewUsers.push(c1Id, c3Id);
  await admin.from("reviews").delete().in("user_id", reviewUsers);
  const { data: ownItem } = await admin.from("order_items").select("variant_id, qty, product_id").eq("order_id", own.data!.order_id).single();
  const product = ownItem!.product_id!;
  const early = await c1.from("reviews").insert({ product_id: product, user_id: c1Id, rating: 5, content: "Smoke review" });
  await transition(own.data!.order_id, "confirmed", "shipped", "delivered");
  deliveredItems.push({ variant_id: ownItem!.variant_id!, qty: ownItem!.qty });
  const posted = await c1.from("reviews").insert({ product_id: product, user_id: c1Id, rating: 5, content: "Smoke review" }).select("id, author_name, is_visible").single();
  const { data: c1Profile } = await admin.from("profiles").select("full_name").eq("id", c1Id).single();
  const { data: expectedName } = await admin.rpc("short_author_name", { p_name: c1Profile!.full_name });
  check("reviews: only after delivery; author snapshot set server-side",
    !!early.error && !posted.error && posted.data?.author_name === expectedName && posted.data?.is_visible === true,
    `early=${early.error?.code} posted=${posted.error?.message ?? posted.data?.author_name} expected=${expectedName}`);
  const reviewId = posted.data!.id;

  const { data: names } = await admin.rpc("short_author_name", { p_name: "  Nguyễn  Văn An " });
  const { data: single } = await admin.rpc("short_author_name", { p_name: "An" });
  const { data: none } = await admin.rpc("short_author_name", { p_name: null as unknown as string });
  check("reviews: short name 'Nguyễn Văn An' → 'An N. V.', one word kept, none → Khách hàng",
    names === "An N. V." && single === "An" && none === "Khách hàng", `${names} | ${single} | ${none}`);

  const [forgedName, forgedDate, selfUnhide, edit, strangerReview, strangerEdit] = await Promise.all([
    c1.from("reviews").update({ author_name: "Admin" } as never).eq("id", reviewId),
    c3.from("reviews").insert({ product_id: product, user_id: c3Id, rating: 5, content: "x", created_at: "2020-01-01" } as never),
    c1.from("reviews").update({ is_visible: false } as never).eq("id", reviewId),
    c1.from("reviews").update({ rating: 4, content: "Edited" }).eq("id", reviewId).select("rating"),
    c3.from("reviews").insert({ product_id: product, user_id: c3Id, rating: 1, content: "Not a buyer" }),
    c3.from("reviews").update({ content: "Hijack" }).eq("id", reviewId).select("id"),
  ]);
  check("reviews: own edit of rating/content only; author_name / is_visible / created_at / other users blocked",
    !!forgedName.error && !!forgedDate.error && !!selfUnhide.error && edit.data?.[0]?.rating === 4
      && !!strangerReview.error && strangerEdit.data?.length === 0,
    `name=${forgedName.error?.code} date=${forgedDate.error?.code} vis=${selfUnhide.error?.code} edit=${edit.data?.[0]?.rating} stranger=${strangerReview.error?.code} hijack=${strangerEdit.data?.length}`);

  // Phone path: a guest delivered order (case 11, PHONES[4]) counts for a profile with that phone.
  const { data: guestItem } = await admin.from("order_items").select("product_id").eq("order_id", d.data!.order_id).single();
  await admin.from("profiles").update({ phone: PHONES[4] }).eq("id", twoId);
  const { data: byPhone } = await two.rpc("has_delivered_product", { p_product_id: guestItem!.product_id! });
  const { data: notBought } = await c3.rpc("has_delivered_product", { p_product_id: guestItem!.product_id! });
  const anonCheck = await createClient<Database>(url, publishable, noPersist).rpc("has_delivered_product", { p_product_id: product });
  check("reviews: guest order matched by profile phone; non-buyer false; anon can't ask",
    byPhone === true && notBought === false && !!anonCheck.error, `${byPhone} ${notBought} ${anonCheck.error?.code}`);

  const reply = await c3.from("review_replies").insert({ review_id: reviewId, user_id: c3Id, content: "Smoke reply" }).select("id, author_name, is_brand_reply").single();
  const [fakeBrand, replyEdit] = await Promise.all([
    c3.from("review_replies").insert({ review_id: reviewId, user_id: c3Id, content: "Fake brand", is_brand_reply: true } as never),
    c3.from("review_replies").update({ content: "Edited" } as never).eq("id", reply.data?.id ?? ""),
  ]);
  const brand = await admin.from("review_replies").insert({ review_id: reviewId, user_id: c1Id, content: "Cảm ơn bạn!", is_brand_reply: true }).select("id, author_name").single();
  const brandDelete = await c1.from("review_replies").delete().eq("id", brand.data?.id ?? "").select("id");
  check("replies: any customer can reply; brand flag only via service role ('PARANOIDZ'); no edits; brand reply not deletable",
    !reply.error && reply.data?.is_brand_reply === false && reply.data?.author_name !== "PARANOIDZ" && !!fakeBrand.error && !!replyEdit.error
      && brand.data?.author_name === "PARANOIDZ" && brandDelete.data?.length === 0,
    `reply=${reply.error?.message ?? reply.data?.author_name} fake=${fakeBrand.error?.code} edit=${replyEdit.error?.code} brand=${brand.data?.author_name} del=${brandDelete.data?.length}`);

  const anonDb2 = createClient<Database>(url, publishable, noPersist);
  await admin.from("review_replies").update({ is_visible: false }).eq("id", reply.data!.id);
  const { data: anonReplies } = await anonDb2.from("review_replies").select("id").eq("review_id", reviewId);
  const { data: ownHiddenReply } = await c3.from("review_replies").select("id").eq("id", reply.data!.id);
  await admin.from("reviews").update({ is_visible: false }).eq("id", reviewId);
  const [{ data: anonHidden }, { data: ownHidden }, replyToHidden] = await Promise.all([
    anonDb2.from("reviews").select("id").eq("id", reviewId),
    c1.from("reviews").select("id").eq("id", reviewId),
    c3.from("review_replies").insert({ review_id: reviewId, user_id: c3Id, content: "Late reply" }),
  ]);
  check("moderation: hidden reply/review gone for the public, still visible to its author; no replies to a hidden review",
    anonReplies?.length === 1 && ownHiddenReply?.length === 1 && anonHidden?.length === 0 && ownHidden?.length === 1 && !!replyToHidden.error,
    `anonReplies=${anonReplies?.length} ownReply=${ownHiddenReply?.length} anonReview=${anonHidden?.length} own=${ownHidden?.length} late=${replyToHidden.error?.code}`);

  const deleted = await c1.from("reviews").delete().eq("id", reviewId).select("id");
  const { count: repliesLeft } = await admin.from("review_replies").select("*", { count: "exact", head: true }).eq("review_id", reviewId);
  check("reviews: author deletes own review, its replies go with it", deleted.data?.length === 1 && repliesLeft === 0, `${deleted.data?.length} ${repliesLeft}`);

  // 15. Review photos: service role writes only, author + 4-photo cap, moderated reads --------
  // Rows only (no Storage objects): storage_path is plain text here. They cascade with the review.
  const photoReview = await c1.from("reviews").insert({ product_id: product, user_id: c1Id, rating: 5, content: "Smoke photos" }).select("id").single();
  const photoReviewId = photoReview.data!.id;
  const photoRow = (i: number | string, userId = c1Id) =>
    ({ review_id: photoReviewId, user_id: userId, storage_path: `${c1Id}/${photoReviewId}/smoke-${i}.jpg`, sort_order: Number(i) || 0 });
  const firstFour = [];
  for (let i = 0; i < 4; i++) firstFour.push(await admin.from("review_images").insert(photoRow(i)).select("id").single());
  const [fifth, notAuthor, direct] = await Promise.all([
    admin.from("review_images").insert(photoRow(4)),
    admin.from("review_images").insert(photoRow("stranger", c3Id)),
    c1.from("review_images").insert(photoRow("direct")),
  ]);
  check("review photos: 4 allowed, 5th → REVIEW_IMAGE_LIMIT, non-author → REVIEW_IMAGE_NOT_AUTHOR, customer can't insert",
    firstFour.every((r) => !r.error) && fifth.error?.message === "REVIEW_IMAGE_LIMIT"
      && notAuthor.error?.message === "REVIEW_IMAGE_NOT_AUTHOR" && direct.error?.code === "42501",
    `four=${firstFour.map((r) => r.error?.message ?? "ok").join()} fifth=${fifth.error?.message} stranger=${notAuthor.error?.message} direct=${direct.error?.code}`);

  const anonDb3 = createClient<Database>(url, publishable, noPersist);
  const hiddenPhoto = firstFour[0].data!.id;
  await admin.from("review_images").update({ is_visible: false }).eq("id", hiddenPhoto);
  const [{ data: anonPhotos }, { data: ownPhotos }] = await Promise.all([
    anonDb3.from("review_images").select("id").eq("review_id", photoReviewId),
    c1.from("review_images").select("id").eq("review_id", photoReviewId),
  ]);
  await admin.from("reviews").update({ is_visible: false }).eq("id", photoReviewId);
  const { data: anonOfHidden } = await anonDb3.from("review_images").select("id").eq("review_id", photoReviewId);
  check("review photos: anon sees visible ones only, none of a hidden review; author sees own hidden photo",
    anonPhotos?.length === 3 && !anonPhotos.some((p) => p.id === hiddenPhoto) && ownPhotos?.length === 4 && anonOfHidden?.length === 0,
    `anon=${anonPhotos?.length} own=${ownPhotos?.length} anonHiddenReview=${anonOfHidden?.length}`);

  const { data: bucket } = await admin.storage.getBucket("review-images");
  check("review photos: bucket public, 5 MB, JPEG/PNG/WebP only",
    bucket?.public === true && bucket.file_size_limit === 5242880
      && [...(bucket.allowed_mime_types ?? [])].sort().join() === "image/jpeg,image/png,image/webp",
    JSON.stringify({ public: bucket?.public, limit: bucket?.file_size_limit, types: bucket?.allowed_mime_types }));

  // 16. Shipping fee: SPX rates by zone × 300 g per unit, in the order total ----------
  // Expected values are SPX estimator quotes from HCMC (2026-10-09).
  const quotes: [string, number, number][] = [
    ["TP. Hồ Chí Minh", 1, 18000], ["TP. Hồ Chí Minh", 3, 18000], ["TP. Hồ Chí Minh", 4, 20500], ["TP. Hồ Chí Minh", 20, 43000],
    ["Cần Thơ", 3, 22000], ["Cần Thơ", 5, 24500], ["Cần Thơ", 20, 47000],
    ["Hà Nội", 1, 22000], ["Hà Nội", 4, 27000], ["Hà Nội", 6, 30000], ["Hà Nội", 7, 35000], ["Hà Nội", 20, 70000],
  ];
  const fees = await Promise.all(quotes.map(([p_city, p_units]) => admin.rpc("shipping_fee", { p_city, p_units })));
  const wrong = quotes.filter((q, i) => fees[i].data !== q[2]).map((q, i) => `${q[0]}×${q[1]}=${fees[i].data ?? fees[i].error?.message}`);
  check("shipping: fee table matches SPX quotes (3 zones, 300 g/unit)", wrong.length === 0, wrong.join(" | "));

  const [unknownCity, anonFee] = await Promise.all([
    admin.rpc("shipping_fee", { p_city: "Atlantis", p_units: 1 }),
    anon.rpc("shipping_fee", { p_city: "Hà Nội", p_units: 1 }),
  ]);
  check("shipping: unknown city → SHIPPING_UNAVAILABLE; anon can't call shipping_fee",
    unknownCity.error?.message === "SHIPPING_UNAVAILABLE" && !!anonFee.error, `unknown=${unknownCity.error?.message} anon=${anonFee.error?.message}`);

  const shipVariant = await variant(pool[3].id);
  const shipped = await placeOrder([{ variant_id: shipVariant.id, qty: 2 }], { phone: PHONES[2], city: "Hà Nội" });
  const { data: shipRow } = await admin.from("orders").select("subtotal, discount, shipping_fee, shipping_discount, total").eq("id", shipped.data?.order_id ?? "").maybeSingle();
  const badCity = await placeOrder([{ variant_id: shipVariant.id, qty: 1 }], { phone: PHONES[2], city: "Atlantis" });
  // 2 units on standard delivery also ship free (pricing v2): the fee is stored and waived in shipping_discount.
  check("shipping: order stores the fee, total = subtotal − discount + shipping − shipping_discount; unknown city refused before stock",
    !shipped.error && shipRow?.shipping_fee === 22000 && shipped.data?.shipping_fee === 22000 && shipRow.shipping_discount === 22000
      && shipRow.total === shipRow.subtotal - shipRow.discount + 22000 - 22000 && shipped.data?.total === shipRow.total
      && badCity.error?.message === "SHIPPING_UNAVAILABLE" && (await variant(pool[3].id)).stock === shipVariant.stock - 2,
    `err=${shipped.error?.message} row=${JSON.stringify(shipRow)} badCity=${badCity.error?.message}`);

  // 17. Checkout quote: quote_order() prices like place_order() (shared order_discount) --------
  type Quote = {
    subtotal: number; discount: number; phone_known: boolean; free_shipping: boolean;
    vouchers: { code: string; pct: number; amount: number }[]; voucher_errors: { code: string; error: string }[];
  };
  const qVariant = await variant(pool[3].id);
  const qItems = [{ variant_id: qVariant.id, qty: 2 }];
  const quote = async (phone?: string, voucher?: string, db: Db = admin, items = qItems) =>
    (await db.rpc("quote_order", { p_items: items, p_phone: phone, p_voucher_codes: voucher ? ["PDZWELCOME", voucher] : ["PDZWELCOME"] })) as
      { data: Quote | null; error: { message: string } | null };

  // Two phones with different histories from the cases above: the quote must equal the order.
  const pairs = [];
  for (const phone of [PHONES[6], PHONES[2]]) {
    const q = await quote(phone);
    const placed = await placeOrder(qItems, { phone, voucher: "PDZWELCOME" });
    pairs.push({ phone, q: q.data, placed: placed.data, err: q.error?.message ?? placed.error?.message });
  }
  check("quote: subtotal + discount equal what place_order() then charges, for two phones",
    pairs.every((p) => !p.err && p.q?.subtotal === p.placed?.subtotal && p.q?.discount === p.placed?.discount && p.q?.phone_known),
    JSON.stringify(pairs.map((p) => ({ phone: p.phone, quote: p.q && [p.q.subtotal, p.q.discount], order: p.placed && [p.placed.subtotal, p.placed.discount], err: p.err }))));

  const stockBefore = (await variant(pool[3].id)).stock;
  const [noPhone, badCode, plain] = await Promise.all([quote(), quote(PHONES[7], "NO-SUCH-CODE"), quote(PHONES[7])]);
  check("quote: no phone still priced (lần đầu applies); bad code → voucher_errors, priced without it; stock untouched",
    noPhone.data?.phone_known === false && noPhone.data.vouchers[0]?.code === "PDZWELCOME" && noPhone.data.discount > 0
      && badCode.data?.voucher_errors[0]?.code === "NO-SUCH-CODE" && badCode.data.voucher_errors[0]?.error === "INVALID_VOUCHER"
      && badCode.data.discount === plain.data?.discount && (await variant(pool[3].id)).stock === stockBefore,
    `noPhone=${JSON.stringify(noPhone.data ?? noPhone.error)} bad=${JSON.stringify(badCode.data ?? badCode.error)} plain=${plain.data?.discount}`);

  await admin.from("vouchers").delete().eq("code", QUOTE_VOUCHER);
  const { error: qvErr } = await admin.from("vouchers").insert({ code: QUOTE_VOUCHER, type: "promo", discount_pct: 30 });
  if (qvErr) throw qvErr;
  const promoItems = [{ variant_id: pool[1].id, qty: 1 }]; // pool[3] may be used up by now
  const promoQuote = await quote(QUOTE_PHONE, QUOTE_VOUCHER.toLowerCase(), admin, promoItems);
  const promoPlaced = await placeOrder(promoItems, { phone: QUOTE_PHONE, vouchers: ["PDZWELCOME", QUOTE_VOUCHER] });
  const usedQuote = await quote(QUOTE_PHONE, QUOTE_VOUCHER, admin, promoItems);
  const [lanDau, promo30] = promoQuote.data?.vouchers ?? [];
  check("quote: lần đầu then a 30% promo on what's left, equals the order; after use → VOUCHER_ALREADY_USED, priced without it",
    lanDau?.code === "PDZWELCOME" && promo30?.code === QUOTE_VOUCHER && promo30.pct === 30
      && promoQuote.data!.discount === lanDau.amount + promo30.amount && promoQuote.data!.discount === promoPlaced.data?.discount
      && usedQuote.data?.voucher_errors[0]?.error === "VOUCHER_ALREADY_USED" && usedQuote.data.vouchers.length === 1,
    `quote=${JSON.stringify(promoQuote.data ?? promoQuote.error)} order=${promoPlaced.data?.discount ?? promoPlaced.error?.message} after=${JSON.stringify(usedQuote.data ?? usedQuote.error)}`);

  const [anonQuote, customerQuote, anonDiscount] = await Promise.all([
    quote(PHONES[7], undefined, anon),
    quote(PHONES[7], undefined, c1),
    anon.rpc("order_discount", { p_phone: PHONES[7], p_subtotal: 100000, p_counts: {}, p_voucher_codes: [] }),
  ]);
  check("quote: anon and signed-in customers can't call quote_order / order_discount",
    !!anonQuote.error && !!customerQuote.error && !!anonDiscount.error,
    `anon=${anonQuote.error?.message} customer=${customerQuote.error?.message} discount=${anonDiscount.error?.message}`);

  // 18. SPX shipment columns: only the service role writes them, tracking number unique --------
  const spxOrder = await placeOrder(one(), { phone: QUOTE_PHONE, userId: c1Id });
  const spxId = spxOrder.data?.order_id ?? "";
  const [spxOwnTry, spxAnonTry] = await Promise.all(
    [c1, anon].map((db) => db.from("orders").update({ spx_tracking_no: "SPXVN-SMOKE-HACK" }).eq("id", spxId).select("id")),
  );
  const { data: ownRow } = await c1.from("orders").select("id").eq("id", spxId).maybeSingle();
  const { error: spxWriteErr } = await admin.from("orders").update({
    spx_tracking_no: "SPXVN-SMOKE-18", spx_ward: "Phường Phú Thạnh", spx_fee: 21, spx_created_at: new Date().toISOString(),
  }).eq("id", spxId);
  const { error: spxDupErr } = await admin.from("orders").update({ spx_tracking_no: "SPXVN-SMOKE-18" }).eq("id", createdOrders[0]);
  const { data: spxRow } = await admin.from("orders").select("spx_tracking_no, spx_ward, spx_fee").eq("id", spxId).maybeSingle();
  check("spx: customer (own order) and anon can't write SPX columns; service role can; tracking number unique",
    !spxOrder.error && !!ownRow && (!!spxOwnTry.error || spxOwnTry.data?.length === 0) && (!!spxAnonTry.error || spxAnonTry.data?.length === 0)
      && !spxWriteErr && spxDupErr?.code === "23505" && spxRow?.spx_tracking_no === "SPXVN-SMOKE-18" && spxRow.spx_fee === 21,
    `place=${spxOrder.error?.message} own=${JSON.stringify(spxOwnTry.data ?? spxOwnTry.error)} anon=${JSON.stringify(spxAnonTry.data ?? spxAnonTry.error)} write=${spxWriteErr?.message} dup=${spxDupErr?.code} row=${JSON.stringify(spxRow)}`);

  // 19. Live SPX fee: the caller's fee is charged within 0 … 3 × table, voucher stored with it --------
  // Hà Nội, 1 unit → table fee ₫22.000, so ₫66.000 is the most a quote may charge.
  const feeItems = [{ variant_id: pool[1].id, qty: 1 }];
  const liveFee = await placeOrder(feeItems, { phone: FEE_PHONE, city: "Hà Nội", shippingFee: 15000, spxVoucher: " SPXV1 " });
  const tableFee = await placeOrder(feeItems, { phone: FEE_PHONE, city: "Hà Nội", spxVoucher: "SPXV1" });
  const { data: feeRows } = await admin.from("orders").select("id, subtotal, discount, shipping_fee, total, spx_voucher")
    .in("id", [liveFee.data?.order_id ?? "", tableFee.data?.order_id ?? ""]);
  const liveRow = feeRows?.find((r) => r.id === liveFee.data?.order_id);
  const tableRow = feeRows?.find((r) => r.id === tableFee.data?.order_id);
  check("spx fee: quoted fee charged + voucher stored; no fee → table fee, voucher dropped",
    liveRow?.shipping_fee === 15000 && liveRow.spx_voucher === "SPXV1" && liveRow.total === liveRow.subtotal - liveRow.discount + 15000
      && liveFee.data?.shipping_fee === 15000 && tableRow?.shipping_fee === 22000 && tableRow.spx_voucher === null,
    `live=${JSON.stringify(liveRow ?? liveFee.error)} table=${JSON.stringify(tableRow ?? tableFee.error)}`);

  const feeStock = (await variant(pool[1].id)).stock;
  const [overMax, belowZero, fraction] = await Promise.all(
    [66001, -1, 15000.5].map((shippingFee) => placeOrder(feeItems, { phone: FEE_PHONE, city: "Hà Nội", shippingFee })),
  );
  const feeStockAfter = (await variant(pool[1].id)).stock;
  const atMax = await placeOrder(feeItems, { phone: FEE_PHONE, city: "Hà Nội", shippingFee: 66000 });
  check("spx fee: above 3 × table, negative or fractional → INVALID_SHIPPING_FEE before stock; 3 × table allowed",
    [overMax, belowZero, fraction].every((r) => r.error?.message === "INVALID_SHIPPING_FEE") && feeStockAfter === feeStock
      && !atMax.error && atMax.data?.shipping_fee === 66000,
    `over=${overMax.error?.message} neg=${belowZero.error?.message} frac=${fraction.error?.message} stock ${feeStock}→${feeStockAfter} max=${atMax.error?.message ?? atMax.data?.shipping_fee}`);

  const [anonFeeTry, customerFeeTry] = await Promise.all(
    [anon, c1].map((db) => placeOrder(feeItems, { phone: FEE_PHONE, city: "Hà Nội", shippingFee: 0, db })),
  );
  check("spx fee: anon and signed-in browsers can't call place_order with a fee",
    !!anonFeeTry.error && !!customerFeeTry.error, `anon=${anonFeeTry.error?.message} customer=${customerFeeTry.error?.message}`);

  // 20. SPX-side failure (lost, damaged, pickup failed): stock back, no refusal for the customer --------
  const lostItems = one();
  const lostStock = (await variant(lostItems[0].variant_id)).stock;
  const lost = await placeOrder(lostItems, { phone: LOST_PHONE });
  if (!lost.data) throw new Error(`case 20 place_order: ${lost.error?.message}`);
  await transition(lost.data.order_id, "confirmed", "shipped");
  const refusalsBefore = (await customer(LOST_PHONE))?.refusal_count;
  const { error: lostError } = await admin.rpc("transition_order_status", {
    p_order_id: lost.data.order_id, p_new_status: "delivery_failed", p_count_refusal: false,
  });
  const refusalsAfter = (await customer(LOST_PHONE))?.refusal_count;
  const lostStockAfter = (await variant(lostItems[0].variant_id)).stock;
  check("delivery_failed with p_count_refusal false: stock restored, refusal_count unchanged",
    !lostError && refusalsAfter === refusalsBefore && lostStockAfter === lostStock,
    `err=${lostError?.message ?? "none"} refusals ${refusalsBefore}→${refusalsAfter} stock ${lostStock}→${lostStockAfter}`);

  // 21. Delivery method is written by place_order() itself, validated before any stock change --------
  const dmItems = [{ variant_id: pool[1].id, qty: 1 }];
  const express = await placeOrder(dmItems, { phone: DELIVERY_PHONE, deliveryMethod: "express" });
  const standard = await placeOrder(dmItems, { phone: DELIVERY_PHONE });
  const { data: dmRows } = await admin.from("orders").select("id, delivery_method")
    .in("id", [express.data?.order_id ?? "", standard.data?.order_id ?? ""]);
  const dmOf = (id?: string) => dmRows?.find((r) => r.id === id)?.delivery_method;
  check("delivery method: express is stored by the same insert; no argument → standard",
    !express.error && !standard.error && dmOf(express.data?.order_id) === "express" && dmOf(standard.data?.order_id) === "standard",
    `express=${express.error?.message ?? dmOf(express.data?.order_id)} default=${standard.error?.message ?? dmOf(standard.data?.order_id)}`);

  const dmStock = (await variant(pool[1].id)).stock;
  const badMethod = await placeOrder(dmItems, { phone: DELIVERY_PHONE, deliveryMethod: "drone" });
  check("delivery method: unknown value → INVALID_DELIVERY_METHOD, stock unchanged",
    badMethod.error?.message === "INVALID_DELIVERY_METHOD" && (await variant(pool[1].id)).stock === dmStock,
    `err=${badMethod.error?.message} stock ${dmStock}→${(await variant(pool[1].id)).stock}`);

  const anonMethod = await anon.rpc("place_order", {
    p_items: dmItems, p_recipient_name: "Smoke Test", p_phone: DELIVERY_PHONE, p_address: "1 Test St",
    p_city: "TP. Hồ Chí Minh", p_delivery_method: "express",
  });
  if (anonMethod.data) createdOrders.push((anonMethod.data as Placed).order_id); // only if the grant is wrong
  check("delivery method: anon can't call place_order (42501, no second overload)",
    anonMethod.error?.code === "42501", `code=${anonMethod.error?.code} msg=${anonMethod.error?.message}`);

  // 22. Pricing v2 schema: one gift variant, several codes per order, free shipping within the fee --------
  const [giftA, giftB] = [pool[1].id, pool[2].id];
  const { error: giftAError } = await admin.from("product_variants").update({ is_order_gift: true }).eq("id", giftA);
  const { error: giftBError } = await admin.from("product_variants").update({ is_order_gift: true }).eq("id", giftB);
  await admin.from("product_variants").update({ is_order_gift: false }).in("id", [giftA, giftB]);
  check("pricing v2: a second gift variant is refused (23505)",
    !giftAError && giftBError?.code === "23505", `first=${giftAError?.message ?? "ok"} second=${giftBError?.code}`);

  const v2Order = standard.data?.order_id ?? "";
  const { data: v2Codes } = await admin.from("vouchers").select("id").in("code", [VOUCHER, QUOTE_VOUCHER]);
  const v2Ids = (v2Codes ?? []).map((v) => v.id);
  const v2Use = (voucher_id: string) => ({ voucher_id, order_id: v2Order, phone: DELIVERY_PHONE, voucher_type: "promo" as const });
  const { error: twoCodes } = await admin.from("voucher_uses").insert(v2Ids.map(v2Use));
  const { error: sameCode } = await admin.from("voucher_uses").insert(v2Use(v2Ids[0]));
  await admin.from("voucher_uses").delete().eq("order_id", v2Order).in("voucher_id", v2Ids);
  check("pricing v2: two different codes on one order allowed, the same code twice refused (23505)",
    v2Ids.length === 2 && !twoCodes && sameCode?.code === "23505", `two=${twoCodes?.message ?? "ok"} same=${sameCode?.code}`);

  const { data: v2Row } = await admin.from("orders").select("total, shipping_fee").eq("id", v2Order).single();
  const [v2Fee, v2Total] = [Number(v2Row?.shipping_fee), Number(v2Row?.total)];
  const waive = (shipping_discount: number, total: number) =>
    admin.from("orders").update({ shipping_discount, total }).eq("id", v2Order);
  const overFee = await waive(v2Fee + 1, v2Total - v2Fee - 1);
  const totalUnchanged = await waive(v2Fee, v2Total);
  const waived = await waive(v2Fee, v2Total - v2Fee);
  await waive(0, v2Total);
  check("pricing v2: shipping_discount ≤ shipping_fee and subtracted in the total (23514 otherwise)",
    v2Fee > 0 && overFee.error?.code === "23514" && totalUnchanged.error?.code === "23514" && !waived.error,
    `fee=${v2Fee} over=${overFee.error?.code} unchanged=${totalUnchanged.error?.code} waived=${waived.error?.message ?? "ok"}`);

  // 23. Pricing v2 rules (PR C): free shipping, gift from stock, PRICE_CHANGED, flash price, gacha --------
  // Every order of V2_PHONE is confirmed right away to stay under the 3-pending limit.
  const v2Place = async (items: { variant_id: string; qty: number }[], opts: Parameters<typeof placeOrder>[1] = {}) => {
    const r = await placeOrder(items, { phone: V2_PHONE, ...opts });
    if (r.data) await transition(r.data.order_id, "confirmed");
    return r;
  };
  const giftRows = async (orderId?: string) =>
    (await admin.from("order_items").select("variant_id, qty, price_snapshot, is_gift").eq("order_id", orderId ?? "").eq("is_gift", true)).data ?? [];
  const shirt = (qty: number) => [{ variant_id: pool[2].id, qty }];

  giftVariant = pool[0].id;
  await admin.from("product_variants").update({ is_order_gift: true }).eq("id", giftVariant);
  const giftStock = (await variant(giftVariant)).stock;
  const v2Two = await v2Place(shirt(2));
  const v2TwoGift = await giftRows(v2Two.data?.order_id);
  const giftAfter = (await variant(giftVariant)).stock;
  const v2Express = await v2Place(shirt(2), { deliveryMethod: "express" });
  check("pricing v2: 2 units standard → whole fee waived + 1 gift from stock (₫0 line); express → no free shipping",
    !v2Two.error && v2Two.data!.shipping_fee > 0 && v2Two.data!.shipping_discount === v2Two.data!.shipping_fee
      && v2Two.data!.total === v2Two.data!.subtotal - v2Two.data!.discount + v2Two.data!.shipping_fee - v2Two.data!.shipping_discount
      && v2TwoGift.length === 1 && v2TwoGift[0].qty === 1 && v2TwoGift[0].price_snapshot === 0 && giftAfter === giftStock - 1
      && !v2Express.error && v2Express.data!.shipping_discount === 0 && v2Express.data!.gift_qty === 1,
    `v2Two=${JSON.stringify(v2Two.data ?? v2Two.error)} gift=${JSON.stringify(v2TwoGift)} stock ${giftStock}→${giftAfter} v2Express=${JSON.stringify(v2Express.data ?? v2Express.error)}`);

  const giftKeep = (await variant(giftVariant)).stock;
  await admin.from("product_variants").update({ stock: 0 }).eq("id", giftVariant);
  const noGift = await v2Place(shirt(1));
  await admin.from("product_variants").update({ stock: giftKeep }).eq("id", giftVariant);
  check("pricing v2: gift out of stock → order still placed, gift_missing, no gift line",
    !noGift.error && noGift.data!.gift_missing && noGift.data!.gift_qty === 0 && (await giftRows(noGift.data?.order_id)).length === 0,
    JSON.stringify(noGift.data ?? noGift.error));

  // PRICE_CHANGED: the total the page showed vs the one place_order() computes (HCMC, 1 unit: ₫18.000).
  const { data: pq } = await admin.rpc("quote_order", { p_items: shirt(1), p_phone: V2_PHONE, p_voucher_codes: ["PDZWELCOME"] });
  const v2Shown = (pq as { subtotal: number; discount: number }).subtotal - (pq as { discount: number }).discount + 18000;
  const pcStock = (await variant(pool[2].id)).stock;
  const v2Stale = await v2Place(shirt(1), { voucher: "PDZWELCOME", expectedTotal: v2Shown + 1000 });
  const pcStockAfter = (await variant(pool[2].id)).stock;
  const v2Fresh = await v2Place(shirt(1), { voucher: "PDZWELCOME", expectedTotal: v2Shown });
  check("pricing v2: expected total off → PRICE_CHANGED:<real total>, nothing written; matching total → placed",
    v2Stale.error?.message === `PRICE_CHANGED:${v2Shown}` && pcStockAfter === pcStock && !v2Fresh.error && v2Fresh.data!.total === v2Shown,
    `v2Stale=${v2Stale.error?.message} v2Shown=${v2Shown} stock ${pcStock}→${pcStockAfter} v2Fresh=${v2Fresh.data?.total ?? v2Fresh.error?.message}`);

  // Flash price = item price: a window open now, the storefront's rounding (nearest ₫1.000).
  const vnHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  const { data: hourRow } = await admin.from("flash_sale_windows").select("*").eq("start_hour", vnHour).maybeSingle();
  flashTestWindow = hourRow ? { id: hourRow.id, prev: hourRow } : null;
  if (hourRow) await admin.from("flash_sale_windows").update({ enabled: true, duration_minutes: 120, discount_percent: 20 }).eq("id", hourRow.id);
  else {
    const { data: ins } = await admin.from("flash_sale_windows").insert({ start_hour: vnHour, duration_minutes: 120, discount_percent: 20 }).select("*").single();
    flashTestWindow = ins ? { id: ins.id, prev: null } : null;
  }
  const { data: picks } = await anon.rpc("flash_sale_picks");
  const { data: pickVariant } = await admin.from("product_variants").select("id, price, stock")
    .in("product_id", (picks as string[] | null) ?? []).gt("stock", 0).order("price").limit(1).maybeSingle();
  const flashExpect = pickVariant ? Math.max(0, Math.round((pickVariant.price * 0.8) / 1000) * 1000) : -1;
  const fq = pickVariant ? (await admin.rpc("quote_order", { p_items: [{ variant_id: pickVariant.id, qty: 1 }] })).data as
    { lines: { price: number; list_price: number; flash: boolean }[]; flash_window_start: string | null } : null;
  const flashOrder = pickVariant ? await v2Place([{ variant_id: pickVariant.id, qty: 1 }]) : null;
  const { data: flashLine } = await admin.from("order_items").select("price_snapshot, list_price_snapshot")
    .eq("order_id", flashOrder?.data?.order_id ?? "").eq("is_gift", false).maybeSingle();
  check("pricing v2: flash window → quote line + order charge the rounded flash price, list price kept, window start returned",
    !!pickVariant && fq?.lines[0]?.flash === true && fq.lines[0].price === flashExpect && !!fq.flash_window_start
      && flashOrder?.data?.subtotal === flashExpect && flashLine?.price_snapshot === flashExpect && flashLine?.list_price_snapshot === pickVariant.price,
    `pick=${JSON.stringify(pickVariant)} expect=${flashExpect} quote=${JSON.stringify(fq?.lines)} line=${JSON.stringify(flashLine)}`);
  await restoreFlashWindow();

  // Gacha: freeship on an order that already ships free stays unused; socks3 adds 3 to the gift line.
  const expires = new Date(Date.now() + 86400_000).toISOString();
  await admin.from("gacha_codes").insert([
    { code: "GACHA-SMKFS1", prize_type: "freeship", tier: "epic", expires_at: expires },
    { code: "GACHA-SMKSK3", prize_type: "socks3", tier: "epic", expires_at: expires },
  ]);
  const fsOrder = await v2Place(shirt(2), { gachaCode: "GACHA-SMKFS1" });
  const { data: fsCode } = await admin.from("gacha_codes").select("status").eq("code", "GACHA-SMKFS1").single();
  // +10 gift stock for the 4 pairs, taken back after, so cleanup's cancel ends at the original count.
  await admin.from("product_variants").update({ stock: (await variant(giftVariant)).stock + 10 }).eq("id", giftVariant);
  const skOrder = await v2Place([{ variant_id: pool[1].id, qty: 1 }], { gachaCode: "GACHA-SMKSK3" }); // pool[2] is spent by now
  await admin.from("product_variants").update({ stock: (await variant(giftVariant)).stock - 10 }).eq("id", giftVariant);
  const skGift = await giftRows(skOrder.data?.order_id);
  check("pricing v2: gacha freeship not redeemed when already free; gacha socks3 → gift line of 1 + 3",
    !fsOrder.error && fsOrder.data!.gacha_redeemed === false && fsCode?.status === "issued"
      && !skOrder.error && skOrder.data!.gift_qty === 4 && skGift[0]?.qty === 4,
    `fs=${JSON.stringify(fsOrder.data ?? fsOrder.error)} code=${fsCode?.status} sk=${JSON.stringify(skOrder.data ?? skOrder.error)} gift=${JSON.stringify(skGift)}`);

  // Cancel releases every code of a multi-code order (lần đầu + promo from case 17).
  if (promoPlaced.data) await transition(promoPlaced.data.order_id, "cancelled");
  const { data: released } = await admin.from("voucher_uses").select("released_at").eq("order_id", promoPlaced.data?.order_id ?? "");
  const { data: qvAfter } = await admin.from("vouchers").select("used_count").eq("code", QUOTE_VOUCHER).single();
  check("pricing v2: cancelling a 2-code order releases both uses and gives the promo its count back",
    released?.length === 2 && released.every((u) => u.released_at !== null) && qvAfter?.used_count === 0,
    `released=${JSON.stringify(released)} used_count=${qvAfter?.used_count}`);
}

// Case 23 changes a flash window, the gift flag and PDZWELCOME's counter; put them back.
async function restoreFlashWindow() {
  if (!flashTestWindow) return;
  const { id, prev } = flashTestWindow;
  if (prev) await admin.from("flash_sale_windows").update({ enabled: false, duration_minutes: prev.duration_minutes, discount_percent: prev.discount_percent }).eq("id", id);
  else await admin.from("flash_sale_windows").delete().eq("id", id);
  flashTestWindow = null;
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
  await admin.from("customers").delete().in("phone", [...PHONES, QUOTE_PHONE, FEE_PHONE, LOST_PHONE, DELIVERY_PHONE, V2_PHONE]);
  await admin.from("gacha_codes").delete().like("code", "GACHA-SMK%");
  if (giftVariant) await admin.from("product_variants").update({ is_order_gift: false }).eq("id", giftVariant);
  await restoreFlashWindow();
  if (welcomeUsedBefore !== null) await admin.from("vouchers").update({ used_count: welcomeUsedBefore }).eq("code", "PDZWELCOME");
  await admin.from("rate_limits").delete().in("bucket", PHONES.flatMap((p) => [`order:phone:${p}`, `lookup:phone:${p}`]));
  await admin.from("rate_limits").delete().or("bucket.like.order:ip:192.0.2.%,bucket.like.order:ip:2001:db8:%");
  await admin.from("vouchers").delete().in("code", [VOUCHER, BUNDLE_VOUCHER, QUOTE_VOUCHER]);
  await admin.from("bundles").delete().like("name", `${BUNDLE_PREFIX}%`);
  if (cartUsers.length) await admin.from("cart_items").delete().in("user_id", cartUsers);
  if (reviewUsers.length) await admin.from("reviews").delete().in("user_id", reviewUsers);
  for (const id of createdUsers) await admin.auth.admin.deleteUser(id);
  // The delivered test order kept its AUTO-FIRST5 use; put the counter back.
  if (autoUsedBefore !== null) await admin.from("vouchers").update({ used_count: autoUsedBefore }).eq("type", "auto_first5");
  if (flashWindows.length) await admin.from("flash_sale_windows").update({ enabled: true }).in("id", flashWindows);
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
