// Runtime smoke test for the BigSeller sync migration (20261012000001_bigseller_sync.sql).
// Run: pnpm --filter @paranoidz/db smoke:inventory   (needs apps/admin/.env.local)
//
// Works on its own temporary product (slug zz-smoke-inventory, hidden except while
// place_order runs) and test phone 0900000011; removes everything it created, including
// the AUTO-FIRST5 use. The only permanent trace is order_number_seq gaps.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/types.ts";

type Db = SupabaseClient<Database>;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing from apps/admin/.env.local");

const noPersist = { auth: { persistSession: false, autoRefreshToken: false } };
const admin: Db = createClient<Database>(url, secret, noPersist);
const anon: Db = createClient<Database>(url, publishable, noPersist);

const SLUG = "zz-smoke-inventory";
const PHONE = "0900000011";
const SKU_A = "ZZSMOKE-Gray-M";
const SKU_B = "ZZSMOKE-Black-M";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

async function stockOf(id: string) {
  const { data, error } = await admin.from("product_variants").select("stock").eq("id", id).single();
  if (error) throw error;
  return data.stock;
}

async function unsentOf(id: string) {
  const { data, error } = await admin.rpc("bigseller_unsent");
  if (error) throw error;
  const row = data.find((r) => r.variant_id === id);
  return { out: row?.unsent_out ?? 0, back: row?.unsent_back ?? 0, adj: row?.unsent_adj ?? 0 };
}

const orders: string[] = [];
let productId: string | null = null;
let autoUsedBefore: number | null = null;

async function main() {
  const { data: auto } = await admin.from("vouchers").select("used_count").eq("type", "auto_first5").single();
  autoUsedBefore = auto?.used_count ?? null;

  await cleanup(); // leftovers from an aborted run
  const { data: product, error: pErr } = await admin.from("products")
    .insert({ name: "ZZ smoke inventory", slug: SLUG, is_active: false }).select("id").single();
  if (pErr) throw pErr;
  productId = product.id;
  const { data: vs, error: vErr } = await admin.from("product_variants").insert([
    { product_id: productId, color: "Gray", size: "M", price: 100000, stock: 10, sku: SKU_A },
    { product_id: productId, color: "Black", size: "M", price: 100000, stock: 10, sku: SKU_B },
    { product_id: productId, color: "Black", size: "L", price: 100000, stock: 10, sku: null },
  ]).select("id, sku, size");
  if (vErr) throw vErr;
  const a = vs.find((v) => v.sku === SKU_A)!.id;
  const b = vs.find((v) => v.sku === SKU_B)!.id;
  const noSku = vs.find((v) => v.sku === null)!.id;

  // 1. adjust_variant_stock --------------------------------------------------
  const plus = await admin.rpc("adjust_variant_stock", { p_variant_id: a, p_delta: 5, p_reason: "Nhập hàng" });
  check("adjust +5 returns the new stock", plus.data === 15 && (await stockOf(a)) === 15, JSON.stringify(plus.error));
  const { data: log } = await admin.from("stock_adjustments").select("id, sku_snapshot, delta, reason").eq("variant_id", a);
  check("adjustment is logged with SKU + reason", log?.length === 1 && log[0].sku_snapshot === SKU_A && log[0].delta === 5 && log[0].reason === "Nhập hàng");
  const neg = await admin.rpc("adjust_variant_stock", { p_variant_id: a, p_delta: -20 });
  check("adjust below 0 → STOCK_NEGATIVE, nothing changes", neg.error?.message === "STOCK_NEGATIVE" && (await stockOf(a)) === 15);
  const zero = await admin.rpc("adjust_variant_stock", { p_variant_id: a, p_delta: 0 });
  check("adjust by 0 → INVALID_DELTA", zero.error?.message === "INVALID_DELTA");
  const sku = await admin.rpc("adjust_variant_stock", { p_variant_id: noSku, p_delta: 1 });
  check("variant without SKU → SKU_REQUIRED, stock unchanged", sku.error?.message === "SKU_REQUIRED" && (await stockOf(noSku)) === 10);
  const missing = await admin.rpc("adjust_variant_stock", { p_variant_id: "00000000-0000-0000-0000-000000000000", p_delta: 1 });
  check("unknown variant → VARIANT_NOT_FOUND", missing.error?.message === "VARIANT_NOT_FOUND");
  const anonAdjust = await anon.rpc("adjust_variant_stock", { p_variant_id: a, p_delta: 1 });
  check("anon cannot adjust", !!anonAdjust.error && (await stockOf(a)) === 15, anonAdjust.error?.message);
  const anonUnsent = await anon.rpc("bigseller_unsent");
  check("anon cannot read bigseller_unsent", !!anonUnsent.error);
  const anonTable = await anon.from("stock_adjustments").select("id");
  check("anon sees no stock_adjustments rows", (anonTable.data ?? []).length === 0);

  // 2. place_order snapshots the SKU; unsent counts ----------------------------
  await admin.from("products").update({ is_active: true }).eq("id", productId); // place_order needs it active
  const placed = await admin.rpc("place_order", {
    p_items: [{ variant_id: a, qty: 2 }], p_recipient_name: "Smoke Test", p_phone: PHONE,
    p_address: "1 Test St", p_city: "TP. Hồ Chí Minh",
  });
  await admin.from("products").update({ is_active: false }).eq("id", productId);
  if (placed.error) throw placed.error;
  const order = (placed.data as { order_id: string }).order_id;
  orders.push(order);
  const { data: items } = await admin.from("order_items").select("sku_snapshot").eq("order_id", order);
  check("place_order stores sku_snapshot", items?.[0]?.sku_snapshot === SKU_A);
  let u = await unsentOf(a);
  check("pending order counts as unsent_out; adjustment as unsent_adj", u.out === 2 && u.back === 0 && u.adj === 5, JSON.stringify(u));

  // 3. confirm, export, mark ---------------------------------------------------
  await admin.rpc("transition_order_status", { p_order_id: order, p_new_status: "confirmed" });
  const adjId = log![0].id;
  const mark = await admin.rpc("mark_bigseller_sent", { p_out: [order], p_back: [], p_adjustments: [adjId] });
  check("mark_bigseller_sent counts", JSON.stringify(mark.data) === JSON.stringify({ out: 1, back: 0, adjustments: 1 }), JSON.stringify(mark.data ?? mark.error));
  u = await unsentOf(a);
  check("after marking nothing is unsent", u.out === 0 && u.back === 0 && u.adj === 0, JSON.stringify(u));
  const again = await admin.rpc("mark_bigseller_sent", { p_out: [order], p_back: [], p_adjustments: [adjId] });
  check("marking twice is a no-op", JSON.stringify(again.data) === JSON.stringify({ out: 0, back: 0, adjustments: 0 }));
  const anonMark = await anon.rpc("mark_bigseller_sent", { p_out: [], p_back: [], p_adjustments: [] });
  check("anon cannot mark", !!anonMark.error);

  // 4. cancel after export → back --------------------------------------------
  await admin.rpc("transition_order_status", { p_order_id: order, p_new_status: "cancelled" });
  u = await unsentOf(a);
  check("exported then cancelled → unsent_back = 2, stock restored", u.back === 2 && (await stockOf(a)) === 15, JSON.stringify(u));
  const back = await admin.rpc("mark_bigseller_sent", { p_out: [], p_back: [order], p_adjustments: [] });
  u = await unsentOf(a);
  check("stock-in marked → nothing unsent", (back.data as { back: number }).back === 1 && u.back === 0, JSON.stringify(u));

  // 5. SKU NFC constraint ------------------------------------------------------
  const nfd = await admin.from("product_variants")
    .insert({ product_id: productId, color: "Xám", size: "S", price: 100000, stock: 0, sku: "ZZSMOKE-Xám-S".normalize("NFD") });
  check("NFD SKU rejected by product_variants_sku_nfc", !!nfd.error && /product_variants_sku_nfc/.test(nfd.error.message), nfd.error?.message);

  // 6. rename_product_color ----------------------------------------------------
  await admin.from("product_images").insert({ product_id: productId, storage_path: `products/${SLUG}/smoke.jpg`, color: "Gray" });
  const renamed = await admin.rpc("rename_product_color", { p_product_id: productId, p_from: "Gray", p_to: " Xám " });
  const { data: after } = await admin.from("product_variants").select("color, sku").eq("id", a).single();
  const { data: img } = await admin.from("product_images").select("color").eq("product_id", productId).single();
  check("rename updates variants and photos, keeps the SKU", !renamed.error && after?.color === "Xám" && after?.sku === SKU_A && img?.color === "Xám", renamed.error?.message);
  const clash = await admin.rpc("rename_product_color", { p_product_id: productId, p_from: "Xám", p_to: "black" });
  check("rename onto another colour (any case) → COLOR_EXISTS", clash.error?.message === "COLOR_EXISTS");
  const gone = await admin.rpc("rename_product_color", { p_product_id: productId, p_from: "Gray", p_to: "Đen" });
  check("unknown colour → COLOR_NOT_FOUND", gone.error?.message === "COLOR_NOT_FOUND");
  const blank = await admin.rpc("rename_product_color", { p_product_id: productId, p_from: "Xám", p_to: "  " });
  check("blank name → INVALID_COLOR", blank.error?.message === "INVALID_COLOR");
  const caseOnly = await admin.rpc("rename_product_color", { p_product_id: productId, p_from: "Black", p_to: "BLACK" });
  check("case-only rename of the same colour is allowed", !caseOnly.error && (await admin.from("product_variants").select("color").eq("id", b).single()).data?.color === "BLACK");
  const anonRename = await anon.rpc("rename_product_color", { p_product_id: productId, p_from: "Xám", p_to: "X" });
  check("anon cannot rename", !!anonRename.error);
}

async function cleanup() {
  if (orders.length) await admin.from("orders").delete().in("id", orders);
  const { data: leftovers } = await admin.from("products").select("id").eq("slug", SLUG);
  for (const p of leftovers ?? []) {
    const { data: vs } = await admin.from("product_variants").select("id").eq("product_id", p.id);
    const ids = (vs ?? []).map((v) => v.id);
    if (ids.length) {
      const { data: items } = await admin.from("order_items").select("order_id").in("variant_id", ids);
      const orderIds = [...new Set((items ?? []).map((i) => i.order_id))];
      if (orderIds.length) await admin.from("orders").delete().in("id", orderIds);
    }
    await admin.from("products").delete().eq("id", p.id);
  }
  await admin.from("stock_adjustments").delete().like("sku_snapshot", "ZZSMOKE-%");
  await admin.from("customers").delete().eq("phone", PHONE);
  if (autoUsedBefore !== null) await admin.from("vouchers").update({ used_count: autoUsedBefore }).eq("type", "auto_first5");
}

try {
  await main();
} catch (e) {
  failures++;
  console.error("ABORTED", e);
} finally {
  await cleanup();
  const { count } = await admin.from("products").select("id", { count: "exact", head: true }).eq("slug", SLUG);
  check("cleanup removed the temporary product", count === 0);
  console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
  process.exit(failures ? 1 : 0);
}
