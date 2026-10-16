import { randomUUID } from "node:crypto";
import { createLocalTestClient } from "@paranoidz/db/testing";

// Test data, written with the local service key. Every test seeds its own product, phone and
// users, so parallel tests never share stock or per-phone limits (first-5 discount, 3 pending
// orders, rate limits). Nothing is cleaned up: the database is throwaway (CI) or reset with
// `supabase db reset` (local).
export const db = createLocalTestClient();

export const uid = () => randomUUID().slice(0, 8);

/** A valid, practically unique Vietnamese mobile number: 09 + 8 digits. */
export function uniquePhone() {
  return "09" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
}

export const CITY = "TP. Hồ Chí Minh";
export const WARD = "Phường Bến Thành"; // in supabase/seed.sql's spx_locations rows

type VariantSeed = { color?: string; size: string; price?: number; originalPrice?: number; stock: number };

export async function seedProduct(variants: VariantSeed[], { name = `E2E Áo ${uid()}` } = {}) {
  const slug = `e2e-${uid()}`;
  const { data: product, error } = await db.from("products").insert({ name, slug, is_active: true }).select("id").single();
  if (error) throw error;
  const { data: rows, error: vErr } = await db
    .from("product_variants")
    .insert(
      variants.map((v) => ({
        product_id: product.id,
        color: v.color ?? "Đen",
        size: v.size,
        price: v.price ?? 200_000,
        original_price: v.originalPrice ?? null,
        stock: v.stock,
        sku: `E2E-${uid()}`.toUpperCase(),
      })),
    )
    .select("id, color, size, price, stock, sku");
  if (vErr) throw vErr;
  const byOrder = variants.map((v) => rows.find((r) => r.size === v.size && r.color === (v.color ?? "Đen"))!);
  return { id: product.id, slug, name, variants: byOrder };
}

export async function variantStock(id: string) {
  const { data, error } = await db.from("product_variants").select("stock").eq("id", id).single();
  if (error) throw error;
  return data.stock;
}

/** A confirmed email/password account; `admin` sets profiles.is_admin. */
export async function createUser({ admin = false } = {}) {
  const email = `e2e-${uid()}@paranoidz.test`;
  const password = randomUUID();
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  if (admin) {
    const { error: pErr } = await db.from("profiles").update({ is_admin: true }).eq("id", data.user.id);
    if (pErr) throw pErr;
  }
  return { id: data.user.id, email, password };
}

/** Places an order the way the storefront's placeOrder action does (service role → place_order). */
export async function placeOrder({ variantId, qty = 1, phone = uniquePhone() }: { variantId: string; qty?: number; phone?: string }) {
  const { data, error } = await db.rpc("place_order", {
    p_items: [{ variant_id: variantId, qty }],
    p_recipient_name: "Khách Hàng Thử",
    p_phone: phone,
    p_address: "1 Lê Lợi",
    p_ward: WARD,
    p_city: CITY,
  });
  if (error) throw error;
  const order = data as { order_id: string; order_number: string; total: number };
  return { id: order.order_id, number: order.order_number, phone };
}

export async function createPromo(pct: number) {
  const code = `E2E${uid()}`.toUpperCase();
  const { error } = await db.from("vouchers").insert({ code, type: "promo", discount_pct: pct });
  if (error) throw error;
  return code;
}
