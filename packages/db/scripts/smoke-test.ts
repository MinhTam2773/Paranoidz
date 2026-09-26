// Runtime smoke test for the init migration's money/stock/security logic.
// Run: pnpm --filter @paranoidz/db smoke   (needs apps/admin/.env.local)
//
// Acts as real seeded customers: sessions come from the admin magic-link API
// (generateLink → verifyOtp), so auth.uid() is genuine inside place_order().
// Cleans up after itself; the only permanent trace is order_number_seq gaps.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/types.ts";

type Db = SupabaseClient<Database>;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing from apps/admin/.env.local");

const noPersist = { auth: { persistSession: false, autoRefreshToken: false } };
const admin: Db = createClient<Database>(url, secret, noPersist);

const CUSTOMERS = ["customer1@paranoidz.test", "customer2@paranoidz.test", "customer3@paranoidz.test"];
const VOUCHER = "SMOKE-TEST";

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

async function placeOrder(db: Db, items: { variant_id: string; qty: number }[], voucher?: string) {
  return db.rpc("place_order", {
    p_items: items,
    p_recipient_name: "Smoke Test",
    p_phone: "0900000000",
    p_address: "1 Test St",
    p_city: "TP. Hồ Chí Minh",
    p_voucher_code: voucher,
  });
}

const createdOrders: string[] = [];

async function main() {
  const [c1, c2, c3] = await Promise.all(CUSTOMERS.map(signInAs));

  // Pick in-stock variants so the test doesn't depend on the seed's random stock.
  const { data: pool } = await admin
    .from("product_variants").select("id, stock").gte("stock", 5).order("id");
  if (!pool || pool.length < 2) throw new Error("need 2 variants with stock >= 5");

  // 1. Voucher max_uses under concurrent redemption ------------------------
  // 50% beats the 10% auto-first5, so place_order must pick the promo.
  await admin.from("vouchers").delete().eq("code", VOUCHER);
  const { data: v, error: vErr } = await admin.from("vouchers")
    .insert({ code: VOUCHER, type: "promo", discount_pct: 50, max_uses: 1 })
    .select("id").single();
  if (vErr) throw vErr;

  const racer = await variant(pool[0].id);
  const results = await Promise.all(
    [c1, c2, c3].map((db) => placeOrder(db, [{ variant_id: racer.id, qty: 1 }], VOUCHER)),
  );
  for (const r of results) if (r.data) createdOrders.push((r.data as { order_id: string }).order_id);

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
  const { data: dupOrder, error: dupErr } = await placeOrder(c1, [
    { variant_id: dup.id, qty: 1 },
    { variant_id: dup.id, qty: 2 },
  ]);
  if (dupErr) throw dupErr;
  const dupId = (dupOrder as { order_id: string }).order_id;
  createdOrders.push(dupId);
  check("duplicate-variant order decrements 3", (await variant(pool[1].id)).stock === dup.stock - 3);

  const { error: cancelErr } = await admin.rpc("transition_order_status", {
    p_order_id: dupId, p_new_status: "cancelled",
  });
  if (cancelErr) throw cancelErr;
  const dupRestored = await variant(pool[1].id);
  check("cancel restores all 3 units", dupRestored.stock === dup.stock,
    `before=${dup.stock} after-cancel=${dupRestored.stock}`);

  // 3. Image snapshot picks the exact colourway ----------------------------
  const { data: colourway } = await admin.from("product_variants")
    .select("id, color, products!inner(slug)").gt("stock", 0)
    .eq("products.slug", "paranoid-logo-tee").eq("color", "White").limit(1).single();
  if (!colourway) throw new Error("no in-stock White paranoid-logo-tee variant");
  const { data: imgOrder, error: imgErr } = await placeOrder(c2, [{ variant_id: colourway.id, qty: 1 }]);
  if (imgErr) throw imgErr;
  createdOrders.push((imgOrder as { order_id: string }).order_id);
  const { data: item } = await admin.from("order_items")
    .select("image_snapshot").eq("order_id", (imgOrder as { order_id: string }).order_id).single();
  check("image snapshot = White colourway, not general image",
    item?.image_snapshot === "products/paranoid-logo-tee/white-1.jpg", `got ${item?.image_snapshot}`);

  // 4. Customer cannot set is_admin on their own profile -------------------
  const { data: me } = await c3.auth.getUser();
  const { error: escalate } = await c3.from("profiles")
    .update({ is_admin: true }).eq("id", me.user!.id);
  const { data: prof } = await admin.from("profiles").select("is_admin").eq("id", me.user!.id).single();
  check("is_admin self-update is rejected", !!escalate && prof?.is_admin === false,
    `error=${escalate?.message} is_admin=${prof?.is_admin}`);
  const { error: nameErr } = await c3.from("profiles")
    .update({ full_name: "Lê Minh Châu" }).eq("id", me.user!.id);
  check("full_name self-update still allowed", !nameErr, nameErr?.message);
}

async function cleanup() {
  // Cancel anything still pending so stock is restored, then delete test rows.
  for (const id of createdOrders) {
    const { data } = await admin.from("orders").select("status").eq("id", id).single();
    if (data?.status === "pending") {
      await admin.rpc("transition_order_status", { p_order_id: id, p_new_status: "cancelled" });
    }
  }
  if (createdOrders.length) await admin.from("orders").delete().in("id", createdOrders);
  await admin.from("vouchers").delete().eq("code", VOUCHER);
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
