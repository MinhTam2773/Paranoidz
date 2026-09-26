"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createAdminClient } from "@paranoidz/db/admin";
import { createClient } from "@paranoidz/db/server";
import { CHECKOUT_FIELDS, normalizePhone, validateAll, type CheckoutValues, type FieldErrors } from "@/lib/checkout-validation";
import { HOTLINE } from "@/lib/site";

export type CheckoutInput = { items: { variantId: string; qty: number }[] } & CheckoutValues;

export type CheckoutResult =
  | { ok: true; order: { orderNumber: string; subtotal: number; discount: number; total: number; phone: string } }
  | { ok: false; message?: string; fieldErrors?: FieldErrors };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE_HELP = "Enter a Vietnamese mobile number: 10 digits starting with 03, 05, 07, 08 or 09.";

// place_order() error codes → what the customer sees (and which field it belongs to).
function explain(code: string): CheckoutResult {
  if (code === "INVALID_PHONE") return { ok: false, fieldErrors: { phone: PHONE_HELP } };
  if (code === "INVALID_SECONDARY_PHONE") return { ok: false, fieldErrors: { secondaryPhone: PHONE_HELP } };
  if (code === "INVALID_VOUCHER") return { ok: false, fieldErrors: { voucher: "This code is invalid or has expired." } };
  if (code === "VOUCHER_EXHAUSTED") return { ok: false, fieldErrors: { voucher: "This code has been fully redeemed." } };
  if (code === "VOUCHER_ALREADY_USED")
    return { ok: false, fieldErrors: { voucher: "This code has already been used with this phone number." } };
  if (code.startsWith("OUT_OF_STOCK") || code.startsWith("PRODUCT_INACTIVE"))
    return { ok: false, message: "Some items just sold out or are no longer available. Please review your cart." };
  if (code === "TOO_MANY_ITEMS")
    return { ok: false, message: `Orders are limited to 20 items. For larger orders, call ${HOTLINE}.` };
  if (code === "TOO_MANY_PENDING")
    return { ok: false, message: `This phone number already has 3 orders waiting for our confirmation call. We'll call you soon, or call ${HOTLINE}.` };
  if (code === "BLACKLISTED")
    return { ok: false, message: `We can't take online orders for this phone number. Please call ${HOTLINE}.` };
  return { ok: false, message: `Something went wrong placing your order. Please try again or call ${HOTLINE}.` };
}

// COD order submission (ARCHITECTURE.md §2.2, §4). Guests welcome (§8.2); the session user, if any,
// is attached for order history only — every per-customer rule keys on the phone inside
// place_order(), which also recomputes all prices, stock and vouchers. Nothing the browser sends
// about money is trusted: only variant ids, quantities and delivery details go in.
// Rate limited per IP + phone (hit_order_rate_limit) before any order work.
export async function placeOrder(input: CheckoutInput): Promise<CheckoutResult> {
  const items = Array.isArray(input?.items) ? input.items : [];
  if (
    !items.length || items.length > 20 ||
    !items.every((i) => typeof i?.variantId === "string" && UUID.test(i.variantId) && Number.isInteger(i.qty) && i.qty >= 1 && i.qty <= 20)
  ) {
    return { ok: false, message: "Your order is empty or invalid. Please review your cart." };
  }

  // Same rules as the form (lib/checkout-validation), re-run here because the browser is untrusted.
  const f = {} as CheckoutValues;
  for (const key of CHECKOUT_FIELDS) f[key] = typeof input?.[key] === "string" ? input[key].trim() : "";
  const fieldErrors = validateAll(f);
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };

  const { data: claims } = await (await createClient()).auth.getClaims();
  const admin = createAdminClient();

  // Vercel overwrites these with the real client IP, so they can't be spoofed there.
  // No IP (unexpected off Vercel) → the phone limit still applies.
  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0].trim() ?? "";
  const { data: allowed, error: limitError } = await admin.rpc("hit_order_rate_limit", { p_ip: ip, p_phone: f.phone });
  if (limitError) {
    console.error("hit_order_rate_limit failed", limitError);
    return explain("");
  }
  if (!allowed) return { ok: false, message: `Too many order attempts. Please wait an hour and try again, or call ${HOTLINE}.` };

  const { data, error } = await admin.rpc("place_order", {
    p_items: items.map((i) => ({ variant_id: i.variantId, qty: i.qty })),
    p_recipient_name: f.name,
    p_phone: f.phone,
    p_secondary_phone: f.secondaryPhone || undefined,
    p_email: f.email || undefined,
    p_address: f.address,
    p_ward: f.ward,
    p_city: f.city, // one of the 34 post-2025 provinces; districts no longer exist (p_district unused)
    p_note: f.note || undefined,
    p_voucher_code: f.voucher || undefined,
    p_user_id: claims?.claims.sub,
  });
  if (error) {
    if (!/^[A-Z_]+(:|$)/.test(error.message)) console.error("place_order failed", error);
    return explain(error.message);
  }

  const order = data as { order_number: string; subtotal: number; discount: number; total: number };

  // Stock changed: refresh the ISR catalog + the ordered products now rather than within 60s.
  const { data: variants } = await admin
    .from("product_variants").select("products(slug)").in("id", items.map((i) => i.variantId));
  revalidatePath("/products");
  for (const slug of new Set((variants ?? []).map((v) => v.products.slug))) revalidatePath(`/products/${slug}`);

  return {
    ok: true,
    order: {
      orderNumber: order.order_number,
      subtotal: order.subtotal,
      discount: order.discount,
      total: order.total,
      phone: normalizePhone(f.phone)!,
    },
  };
}
