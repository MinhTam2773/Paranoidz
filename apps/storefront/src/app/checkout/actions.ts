"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { after } from "next/server";
import { createAdminClient } from "@paranoidz/db/admin";
import { createClient } from "@paranoidz/db/server";
import { CHECKOUT_FIELDS, normalizePhone, validateAll, type CheckoutValues, type FieldErrors } from "@/lib/checkout-validation";
import { PROVINCE_NAMES } from "@paranoidz/db/provinces";
import { sendOrderEmails } from "@/lib/order-email";
import { sendZaloAlert } from "@/lib/order-zalo";
import { hitRateLimit } from "@/lib/rate-limit";
import { quoteShipping } from "@/lib/shipping-quote";
import { HOTLINE } from "@/lib/site";
import { isSpxWard, spxWards } from "@/lib/wards";
import { GACHA_COOKIE } from "@/lib/gacha";

// addressId: the saved address the form was filled from, if untouched (links orders.address_id).
// deliveryMethod: "standard" | "express", chosen on the product page / checkout (validated below).
// paymentMethod: "bank_transfer" is special; anything else falls back to COD.
export type CheckoutInput = { items: { variantId: string; qty: number }[]; addressId?: string; deliveryMethod?: string; paymentMethod?: string } & CheckoutValues;

export type CheckoutResult =
  | { ok: true; order: { orderNumber: string; subtotal: number; discount: number; gachaDiscount: number; gachaGift: string | null; shippingFee: number; total: number; phone: string; deliveryMethod: string; paymentMethod: "cod" | "bank_transfer" } }
  | { ok: false; message?: string; fieldErrors?: FieldErrors };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// 1–20 lines of { variantId: uuid, qty: 1–20 }, or null.
function validItems(value: unknown) {
  const items = Array.isArray(value) ? (value as CheckoutInput["items"]) : [];
  const ok = items.length > 0 && items.length <= 20 &&
    items.every((i) => typeof i?.variantId === "string" && UUID.test(i.variantId) && Number.isInteger(i.qty) && i.qty >= 1 && i.qty <= 20);
  return ok ? items : null;
}

const unitsOf = (items: CheckoutInput["items"]) => items.reduce((sum, i) => sum + i.qty, 0);

// Subtotal from database prices: SPX's fee quote takes the parcel value (never the browser's).
async function subtotalOf(items: CheckoutInput["items"]) {
  const { data } = await createAdminClient().from("product_variants").select("id, price").in("id", items.map((i) => i.variantId));
  const price = new Map((data ?? []).map((v) => [v.id, v.price]));
  return items.reduce((sum, i) => sum + (price.get(i.variantId) ?? 0) * i.qty, 0);
}

const PHONE_HELP = "Nhập số di động Việt Nam: 10 chữ số, bắt đầu bằng 03, 05, 07, 08 hoặc 09.";

// Gacha prize-code errors (place_order / gacha_quote_code) → the same wording
// at preview and at submit, shown under the code field.
function gachaMessage(code: string): string | null {
  if (code === "GACHA_INVALID") return "Mã quà không hợp lệ.";
  if (code === "GACHA_USED") return "Mã quà này đã được sử dụng.";
  if (code === "GACHA_EXPIRED") return "Mã quà đã hết hạn.";
  if (code === "GACHA_MIN_NOT_MET") return "Đơn chưa đạt giá trị tối thiểu để dùng mã quà này.";
  if (code === "GACHA_NO_SHIRT") return "Mã quà áo miễn phí cần có ít nhất 1 áo trong giỏ hàng.";
  return null;
}

// place_order() error codes → what the customer sees (and which field it belongs to).
function explain(code: string): CheckoutResult {
  if (code === "INVALID_PHONE") return { ok: false, fieldErrors: { phone: PHONE_HELP } };
  if (code === "INVALID_SECONDARY_PHONE") return { ok: false, fieldErrors: { secondaryPhone: PHONE_HELP } };
  if (code === "INVALID_VOUCHER") return { ok: false, fieldErrors: { voucher: "Mã không hợp lệ hoặc đã hết hạn." } };
  if (code === "VOUCHER_EXHAUSTED") return { ok: false, fieldErrors: { voucher: "Mã đã hết lượt sử dụng." } };
  if (code === "VOUCHER_ALREADY_USED")
    return { ok: false, fieldErrors: { voucher: "Số điện thoại này đã dùng mã này rồi." } };
  const gachaError = gachaMessage(code);
  if (gachaError) return { ok: false, fieldErrors: { voucher: gachaError } };
  if (code.startsWith("OUT_OF_STOCK") || code.startsWith("PRODUCT_INACTIVE"))
    return { ok: false, message: "Một số sản phẩm vừa hết hàng hoặc không còn bán. Vui lòng kiểm tra lại giỏ hàng." };
  if (code === "SHIPPING_UNAVAILABLE")
    return { ok: false, fieldErrors: { city: `Chưa tính được phí giao hàng đến đây. Vui lòng gọi ${HOTLINE}.` } };
  if (code === "INVALID_ADDRESS")
    return { ok: false, message: "Địa chỉ đã lưu này không còn. Hãy chọn địa chỉ khác hoặc nhập địa chỉ mới." };
  if (code === "TOO_MANY_ITEMS")
    return { ok: false, message: `Mỗi đơn tối đa 20 sản phẩm. Đặt số lượng lớn hơn, vui lòng gọi ${HOTLINE}.` };
  if (code === "TOO_MANY_PENDING")
    return { ok: false, message: `Số điện thoại này đã có 3 đơn đang được xử lý. Vui lòng chờ các đơn này được gửi đi, hoặc gọi ${HOTLINE}.` };
  if (code === "BLACKLISTED")
    return { ok: false, message: `Chúng tôi không thể nhận đơn online cho số điện thoại này. Vui lòng gọi ${HOTLINE}.` };
  return { ok: false, message: `Đã có lỗi khi đặt hàng. Vui lòng thử lại hoặc gọi ${HOTLINE}.` };
}

// Order submission (ARCHITECTURE.md §2.2, §4). Guests welcome (§8.2); the session user, if any,
// is attached for order history only — every per-customer rule keys on the phone inside
// place_order(), which also recomputes all prices, stock and vouchers. Nothing the browser sends
// about money is trusted: only variant ids, quantities and delivery details go in. The shipping
// fee is SPX's live quote, asked here again (lib/shipping-quote), or the table inside place_order().
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

  const [wardOk, subtotal] = await Promise.all([isSpxWard(f.city, f.ward), subtotalOf(items)]);
  if (!wardOk) return { ok: false, fieldErrors: { ward: "Chọn phường / xã trong danh sách." } };
  // Delivery method: only "express" is special; anything else falls back to standard.
  // Express is HCMC-only — enforced here too because the browser is untrusted.
  const deliveryMethod = input?.deliveryMethod === "express" ? "express" : "standard";
  if (deliveryMethod === "express" && f.city !== "TP. Hồ Chí Minh") {
    return { ok: false, message: "⚡ Hoả tốc chỉ áp dụng nội thành TP.HCM. Vui lòng chọn giao thường." };
  }
  const shipping = await quoteShipping(f.city, f.ward, unitsOf(items), subtotal);
  if (!shipping) return explain("SHIPPING_UNAVAILABLE");

  // A GACHA-… code in the code field is a game prize, not a promo voucher:
  // it travels as its own parameter and lands on its own discount line.
  const gachaCode = f.voucher.trim().toUpperCase().startsWith("GACHA-") ? f.voucher.trim().toUpperCase() : undefined;

  // The gacha cookie player (if this browser ever played): the order's +2
  // spin grant lands on that player inside place_order(). Read-only — a
  // browser without the cookie simply gets no grant.
  const gachaPlayer = (await cookies()).get(GACHA_COOKIE)?.value || undefined;

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
    p_voucher_code: gachaCode ? undefined : f.voucher || undefined,
    p_user_id: claims?.claims.sub,
    p_address_id: addressId,
    // A table quote is left to place_order() (NULL), which computes the same fee itself.
    p_shipping_fee: shipping.source === "spx" ? shipping.fee : undefined,
    p_spx_voucher: shipping.voucherCode ?? undefined,
    p_delivery_method: deliveryMethod,
    p_gacha_code: gachaCode,
    p_gacha_player: gachaPlayer,
  });
  if (error) {
    if (!/^[A-Z_]+(:|$)/.test(error.message)) console.error("place_order failed", error);
    return explain(error.message);
  }

  const order = data as { order_id: string; order_number: string; subtotal: number; discount: number; gacha_discount: number; gacha_gift: string | null; shipping_fee: number; total: number };

  // Payment method: only "bank_transfer" is special; anything else falls back to COD.
  // place_order() is frozen, so the method is attached the same way delivery_method used
  // to be — a direct update after the rpc. Fail closed: if the update fails (e.g. the
  // payment_method column migration hasn't been applied yet), the order is cancelled
  // so a transfer order can never sit looking like COD and ship unpaid.
  const paymentMethod = input?.paymentMethod === "bank_transfer" ? "bank_transfer" : "cod";
  if (paymentMethod === "bank_transfer") {
    const { error: pmError } = await admin
      .from("orders")
      .update({ payment_method: "bank_transfer" })
      .eq("id", order.order_id);
    if (pmError) {
      console.error("payment_method update failed", pmError);
      await admin.rpc("transition_order_status", { p_order_id: order.order_id, p_new_status: "cancelled" });
      return { ok: false, message: `Không ghi nhận được phương thức chuyển khoản. Đơn chưa được tạo — vui lòng thử lại hoặc gọi ${HOTLINE}.` };
    }
  }

  // Stock changed: refresh the ISR catalog + the ordered products now rather than within 60s.
  const { data: variants } = await admin
    .from("product_variants").select("products(slug)").in("id", items.map((i) => i.variantId));
  revalidatePath("/products");
  for (const slug of new Set((variants ?? []).map((v) => v.products.slug))) revalidatePath(`/products/${slug}`);
  // Confirmation + shop alerts (email, Zalo) after the response is sent; never affects the order.
  after(() => sendOrderEmails(order.order_id));
  after(() => sendZaloAlert(order.order_id));

  return {
    ok: true,
    order: {
      orderNumber: order.order_number,
      subtotal: order.subtotal,
      discount: order.discount,
      gachaDiscount: order.gacha_discount,
      gachaGift: order.gacha_gift,
      shippingFee: order.shipping_fee,
      total: order.total,
      phone: normalizePhone(f.phone)!,
      deliveryMethod,
      paymentMethod,
    },
  };
}

// SPX's wards for a province, for the checkout and address-book ward pickers.
export async function listWards(city: string): Promise<string[]> {
  return typeof city === "string" && PROVINCE_NAMES.has(city) ? spxWards(city) : [];
}

// Checkout preview of the shipping fee (ARCHITECTURE.md §5): the same quote placeOrder asks for
// (cached, so normally the same fee). Each SPX call costs, so previews are rate limited per IP;
// over the limit, the table fee is shown. null = can't quote.
// Returns the fee AND its source so the UI can show the SPX Express carrier card honestly:
// "spx" = SPX's live price, "table" = the shop's standard rate table.
export async function previewShipping(input: { city: string; ward: string; items: CheckoutInput["items"] }): Promise<{ fee: number; source: "spx" | "table" } | null> {
  const items = validItems(input?.items);
  const city = input?.city, ward = input?.ward;
  if (!items || typeof city !== "string" || !PROVINCE_NAMES.has(city) || typeof ward !== "string" || unitsOf(items) > 20) return null;
  const [live, subtotal] = await Promise.all([
    hitRateLimit("shipping", "", { ip: 60, phone: 0 }).catch((limitError) => (console.error("hit_rate_limit failed", limitError), false)),
    subtotalOf(items),
  ]);
  const quote = await quoteShipping(city, ward.slice(0, 100), unitsOf(items), subtotal, live);
  return quote ? { fee: quote.fee, source: quote.source } : null;
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
  flashPct: number | null;
  flashDiscount: number | null;
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
    // Gacha prize codes are quoted separately (quoteGachaCode); quote_order
    // would only reject them as INVALID_VOUCHER.
    p_voucher_code: voucher.toUpperCase().startsWith("GACHA-") ? undefined : voucher || undefined,
  });
  if (error) {
    if (!/^[A-Z_]+(:|$)/.test(error.message)) console.error("quote_order failed", error);
    return null;
  }
  const q = data as {
    subtotal: number; discount: number; source: OrderQuote["source"]; pct: number | null; code: string | null;
    flash_pct: number | null; flash_discount: number | null;
    bundles: { name: string; sets: number }[] | null; phone_known: boolean; voucher_error: string | null;
  };
  return {
    subtotal: q.subtotal,
    discount: q.discount,
    source: q.source,
    pct: q.pct,
    code: q.code,
    flashPct: q.flash_pct,
    flashDiscount: q.flash_discount,
    bundles: (q.bundles ?? []).map((b) => ({ name: b.name, sets: b.sets })),
    phoneKnown: q.phone_known,
    voucherError: q.voucher_error ? voucherMessage(q.voucher_error) : null,
  };
}

export type GachaQuote =
  | { ok: true; prizeType: string; tier: string; discount: number; freeship: boolean; gift: string | null }
  | { ok: false; message: string };

// Checkout preview of a gacha prize code (GACHA-…): gacha_quote_code() prices
// the cart from the database and reports the effect — a money discount, free
// shipping, or a physical gift. Display only; place_order() re-validates and
// redeems at submit. null = can't quote now (rate limited or failed).
export async function quoteGachaCode(input: { items: CheckoutInput["items"]; code: string }): Promise<GachaQuote | null> {
  const items = validItems(input?.items);
  const code = typeof input?.code === "string" ? input.code.trim().toUpperCase().slice(0, 30) : "";
  if (!items || !code.startsWith("GACHA-")) return null;

  try {
    if (!(await hitRateLimit("quote", "", { ip: 60, phone: 0 }))) return null;
  } catch (limitError) {
    console.error("hit_rate_limit failed", limitError);
    return null;
  }

  const { data, error } = await createAdminClient().rpc("gacha_quote_code", {
    p_code: code,
    p_items: items.map((i) => ({ variant_id: i.variantId, qty: i.qty })),
  });
  if (error) {
    console.error("gacha_quote_code failed", error);
    return null;
  }
  const q = data as {
    ok: boolean; error?: string; prize_type?: string; tier?: string;
    discount?: number; freeship?: boolean; gift?: string | null;
  };
  if (!q.ok) return { ok: false, message: gachaMessage(q.error ?? "") ?? "Mã quà không hợp lệ." };
  return {
    ok: true,
    prizeType: q.prize_type ?? "",
    tier: q.tier ?? "",
    discount: q.discount ?? 0,
    freeship: !!q.freeship,
    gift: q.gift ?? null,
  };
}
