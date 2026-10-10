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
const BUNDLE_VOUCHER = "SMOKE-TEST-BUNDLE";
const BUNDLE_PREFIX = "SMOKE-BUNDLE"; // assumes no other active bundle holds the products picked in case 12
const PHONES = Array.from({ length: 9 }, (_, i) => `090000000${i + 1}`);
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
const cartUsers: string[] = [];
const reviewUsers: string[] = [];

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

  // One of each: greedy would take A (300k) and strand p3/p4; B + C = 400k is better. Beats first-5 10%.
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

  // Better of bundle vs promo: a 100% promo beats B; capped at ₫1.000 it loses and isn't consumed.
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
  check("bundles vs promo: better wins, no stacking; losing promo not consumed",
    promoRes.discount === promoWins.data!.subtotal && promoRes.sets === "" && promoRes.voucherUses === 1
      && bundleRes.discount === 200000 && bundleRes.sets === "B×1" && bundleRes.voucherUses === 0 && bvAfter?.used_count === 1,
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
  await admin.from("rate_limits").delete().in("bucket", PHONES.flatMap((p) => [`order:phone:${p}`, `lookup:phone:${p}`]));
  await admin.from("rate_limits").delete().or("bucket.like.order:ip:192.0.2.%,bucket.like.order:ip:2001:db8:%");
  await admin.from("vouchers").delete().in("code", [VOUCHER, BUNDLE_VOUCHER]);
  await admin.from("bundles").delete().like("name", `${BUNDLE_PREFIX}%`);
  if (cartUsers.length) await admin.from("cart_items").delete().in("user_id", cartUsers);
  if (reviewUsers.length) await admin.from("reviews").delete().in("user_id", reviewUsers);
  for (const id of createdUsers) await admin.auth.admin.deleteUser(id);
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
