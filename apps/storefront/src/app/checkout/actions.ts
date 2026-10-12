"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createAdminClient } from "@paranoidz/db/admin";
import { createClient } from "@paranoidz/db/server";
import { CHECKOUT_FIELDS, normalizePhone, validateAll, type CheckoutValues, type FieldErrors } from "@/lib/checkout-validation";
import { PROVINCE_NAMES } from "@/lib/provinces";
import { sendOrderEmails } from "@/lib/order-email";
import { hitRateLimit } from "@/lib/rate-limit";
import { HOTLINE } from "@/lib/site";

// addressId: the saved address the form was filled from, if untouched (links orders.address_id).
export type CheckoutInput = { items: { variantId: string; qty: number }[]; addressId?: string } & CheckoutValues;

export type CheckoutResult =
  | { ok: true; order: { orderNumber: string; subtotal: number; discount: number; shippingFee: number; total: number; phone: string } }
  | { ok: false; message?: string; fieldErrors?: FieldErrors };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// 1–20 lines of { variantId: uuid, qty: 1–20 }, or null.
function validItems(value: unknown) {
  const items = Array.isArray(value) ? (value as CheckoutInput["items"]) : [];
  const ok = items.length > 0 && items.length <= 20 &&
    items.every((i) => typeof i?.variantId === "string" && UUID.test(i.variantId) && Number.isInteger(i.qty) && i.qty >= 1 && i.qty <= 20);
  return ok ? items : null;
}

const PHONE_HELP = "Nhập số di động Việt Nam: 10 chữ số, bắt đầu bằng 03, 05, 07, 08 hoặc 09.";

// place_order() error codes → what the customer sees (and which field it belongs to).
function explain(code: string): CheckoutResult {
  if (code === "INVALID_PHONE") return { ok: false, fieldErrors: { phone: PHONE_HELP } };
  if (code === "INVALID_SECONDARY_PHONE") return { ok: false, fieldErrors: { secondaryPhone: PHONE_HELP } };
  if (code === "INVALID_VOUCHER") return { ok: false, fieldErrors: { voucher: "Mã không hợp lệ hoặc đã hết hạn." } };
  if (code === "VOUCHER_EXHAUSTED") return { ok: false, fieldErrors: { voucher: "Mã đã hết lượt sử dụng." } };
  if (code === "VOUCHER_ALREADY_USED")
    return { ok: false, fieldErrors: { voucher: "Số điện thoại này đã dùng mã này rồi." } };
  if (code.startsWith("OUT_OF_STOCK") || code.startsWith("PRODUCT_INACTIVE"))
    return { ok: false, message: "Một số sản phẩm vừa hết hàng hoặc không còn bán. Vui lòng kiểm tra lại giỏ hàng." };
  if (code === "SHIPPING_UNAVAILABLE")
    return { ok: false, fieldErrors: { city: `Chưa tính được phí giao hàng đến đây. Vui lòng gọi ${HOTLINE}.` } };
  if (code === "INVALID_ADDRESS")
    return { ok: false, message: "Địa chỉ đã lưu này không còn. Hãy chọn địa chỉ khác hoặc nhập địa chỉ mới." };
  if (code === "TOO_MANY_ITEMS")
    return { ok: false, message: `Mỗi đơn tối đa 20 sản phẩm. Đặt số lượng lớn hơn, vui lòng gọi ${HOTLINE}.` };
  if (code === "TOO_MANY_PENDING")
    return { ok: false, message: `Số điện thoại này đã có 3 đơn đang chờ gọi xác nhận. Chúng tôi sẽ sớm gọi cho bạn, hoặc bạn gọi ${HOTLINE}.` };
  if (code === "BLACKLISTED")
    return { ok: false, message: `Chúng tôi không thể nhận đơn online cho số điện thoại này. Vui lòng gọi ${HOTLINE}.` };
  return { ok: false, message: `Đã có lỗi khi đặt hàng. Vui lòng thử lại hoặc gọi ${HOTLINE}.` };
}

// COD order submission (ARCHITECTURE.md §2.2, §4). Guests welcome (§8.2); the session user, if any,
// is attached for order history only — every per-customer rule keys on the phone inside
// place_order(), which also recomputes all prices, stock and vouchers. Nothing the browser sends
// about money is trusted: only variant ids, quantities and delivery details go in.
// Rate limited per IP + phone (lib/rate-limit) before any order work.
export async function placeOrder(input: CheckoutInput): Promise<CheckoutResult> {
  const items = validItems(input?.items);
  if (!items) return { ok: false, message: "Đơn hàng trống hoặc không hợp lệ. Vui lòng kiểm tra lại giỏ hàng." };

  // Same rules as the form (lib/checkout-validation), re-run here because the browser is untrusted.
  const f = {} as CheckoutValues;
  for (const key of CHECKOUT_FIELDS) f[key] = typeof input?.[key] === "string" ? input[key].trim() : "";
  const fieldErrors = validateAll(f);
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };

  const { data: claims } = await (await createClient()).auth.getClaims();
  // Only an account can link a saved address; place_order() also checks it belongs to that user.
  const addressId = claims && typeof input?.addressId === "string" && UUID.test(input.addressId) ? input.addressId : undefined;
  const admin = createAdminClient();

  // Every attempt that gets this far counts, so rejected orders (e.g. voucher guesses) do too.
  let allowed;
  try {
    allowed = await hitRateLimit("order", f.phone, { ip: 10, phone: 5 });
  } catch (limitError) {
    console.error("hit_rate_limit failed", limitError);
    return explain("");
  }
  if (!allowed) return { ok: false, message: `Bạn đã thử đặt hàng quá nhiều lần. Vui lòng đợi một giờ rồi thử lại, hoặc gọi ${HOTLINE}.` };

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
    p_address_id: addressId,
  });
  if (error) {
    if (!/^[A-Z_]+(:|$)/.test(error.message)) console.error("place_order failed", error);
    return explain(error.message);
  }

  const order = data as { order_id: string; order_number: string; subtotal: number; discount: number; shipping_fee: number; total: number };

  // Stock changed: refresh the ISR catalog + the ordered products now rather than within 60s.
  const { data: variants } = await admin
    .from("product_variants").select("products(slug)").in("id", items.map((i) => i.variantId));
  revalidatePath("/products");
  for (const slug of new Set((variants ?? []).map((v) => v.products.slug))) revalidatePath(`/products/${slug}`);
  // Confirmation + shop alert after the response is sent; never affects the order.
  after(() => sendOrderEmails(order.order_id));

  return {
    ok: true,
    order: {
      orderNumber: order.order_number,
      subtotal: order.subtotal,
      discount: order.discount,
      shippingFee: order.shipping_fee,
      total: order.total,
      phone: normalizePhone(f.phone)!,
    },
  };
}

// Checkout preview of the shipping fee (ARCHITECTURE.md §5). Display only: place_order() charges
// shipping_fee() itself from the submitted city and quantities. null = can't quote.
export async function quoteShipping(city: string, units: number): Promise<number | null> {
  if (typeof city !== "string" || !PROVINCE_NAMES.has(city) || !Number.isInteger(units) || units < 1 || units > 20) return null;
  const { data, error } = await createAdminClient().rpc("shipping_fee", { p_city: city, p_units: units });
  return error ? null : data;
}

// The voucher field error place_order() would give for this code (same wording at submit).
function voucherMessage(code: string) {
  const res = explain(code);
  return (!res.ok && res.fieldErrors?.voucher) || null;
}

export type OrderQuote = {
  subtotal: number;
  discount: number;
  source: "auto_first5" | "promo" | "bundle" | null;
  pct: number | null;
  code: string | null;
  bundles: { name: string; sets: number }[];
  phoneKnown: boolean;
  voucherError: string | null;
};

// Checkout preview of the discount (client, 2026-10-11): quote_order() runs the same
// order_discount() as place_order(), without touching stock. No valid phone yet = priced as a new
// customer. Display only — place_order() decides at submit. null = can't quote now (rate limited or
// failed): the page falls back to "applied at checkout". Rate limited per IP + phone so it can't be
// used to try promo codes faster than placing orders would allow by much.
export async function quoteOrder(input: { items: CheckoutInput["items"]; phone: string; voucher: string }): Promise<OrderQuote | null> {
  const items = validItems(input?.items);
  if (!items) return null;
  const phone = typeof input?.phone === "string" ? input.phone.trim().slice(0, 20) : "";
  const voucher = typeof input?.voucher === "string" ? input.voucher.trim().slice(0, 30) : "";

  try {
    if (!(await hitRateLimit("quote", phone, { ip: 60, phone: 30 }))) return null;
  } catch (limitError) {
    console.error("hit_rate_limit failed", limitError);
    return null;
  }

  const { data, error } = await createAdminClient().rpc("quote_order", {
    p_items: items.map((i) => ({ variant_id: i.variantId, qty: i.qty })),
    p_phone: phone || undefined,
    p_voucher_code: voucher || undefined,
  });
  if (error) {
    if (!/^[A-Z_]+(:|$)/.test(error.message)) console.error("quote_order failed", error);
    return null;
  }
  const q = data as {
    subtotal: number; discount: number; source: OrderQuote["source"]; pct: number | null; code: string | null;
    bundles: { name: string; sets: number }[] | null; phone_known: boolean; voucher_error: string | null;
  };
  return {
    subtotal: q.subtotal,
    discount: q.discount,
    source: q.source,
    pct: q.pct,
    code: q.code,
    bundles: (q.bundles ?? []).map((b) => ({ name: b.name, sets: b.sets })),
    phoneKnown: q.phone_known,
    voucherError: q.voucher_error ? voucherMessage(q.voucher_error) : null,
  };
}
