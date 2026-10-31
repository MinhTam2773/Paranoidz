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
import { sendMetaPurchase } from "@/lib/meta-capi";
import { hitRateLimit } from "@/lib/rate-limit";
import { quoteShipping } from "@/lib/shipping-quote";
import { HOTLINE } from "@/lib/site";
import { isSpxWard, spxWards } from "@/lib/wards";
import { GACHA_COOKIE } from "@/lib/gacha";

// addressId: the saved address the form was filled from, if untouched (links orders.address_id).
// deliveryMethod: "standard" | "express", chosen on the product page / checkout (validated below).
// paymentMethod: "bank_transfer" is special; anything else falls back to COD.
// Pricing v2 (all optional until the checkout picker ships):
//   vouchers: the codes picked in the checkout list; absent = the listed "every order" codes
//     (PDZWELCOME), so nobody loses the 10 % meanwhile. The typed `voucher` field is added on top.
//   expectedTotal / flashWindowStart: what the page showed (from quoteOrder); a different
//     total at submit comes back as priceChanged instead of charging a total nobody saw.
export type CheckoutInput = {
  items: { variantId: string; qty: number }[]; addressId?: string; deliveryMethod?: string; paymentMethod?: string;
  vouchers?: string[]; expectedTotal?: number; flashWindowStart?: string | null;
} & CheckoutValues;

export type PriceChange = { reason: "flash_ended" | "flash_started" | "other"; oldTotal: number; newTotal: number };

export type CheckoutResult =
  | { ok: true; order: {
      orderNumber: string; subtotal: number; discount: number; gachaDiscount: number; gachaGift: string | null;
      shippingFee: number; // what the customer pays for shipping (after free shipping)
      shippingFeeBeforeDiscount: number; shippingDiscount: number; giftQty: number;
      total: number; phone: string; deliveryMethod: string; paymentMethod: "cod" | "bank_transfer";
    } }
  | { ok: false; message?: string; fieldErrors?: FieldErrors; priceChanged?: PriceChange };

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

// The voucher codes an order is priced with (pricing v2): the picker's choice, or by default
// every listed "every order" code (PDZWELCOME), plus a typed code that isn't a gacha prize.
async function voucherCodes(picked: unknown, typed: string): Promise<string[]> {
  let codes: string[];
  if (Array.isArray(picked)) {
    codes = picked.filter((c): c is string => typeof c === "string").slice(0, 20);
  } else {
    const { data } = await createAdminClient()
      .from("vouchers").select("code").eq("type", "standing").eq("is_active", true).eq("is_listed", true);
    codes = (data ?? []).map((v) => v.code);
  }
  const t = typed.trim().toUpperCase();
  if (t && !t.startsWith("GACHA-")) codes.push(t);
  return [...new Set(codes.map((c) => c.trim().toUpperCase().slice(0, 30)).filter(Boolean))];
}

const PHONE_HELP ="Nhập số di động Việt Nam: 10 chữ số, bắt đầu bằng 03, 05, 07, 08 hoặc 09.";

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
// Voucher errors carry the code since an order can hold several: "INVALID_VOUCHER:SALE10".
function explain(error: string): CheckoutResult {
  const [code, detail] = error.split(":", 2);
  const which = detail ? `Mã ${detail}` : "Mã";
  if (code === "INVALID_PHONE") return { ok: false, fieldErrors: { phone: PHONE_HELP } };
  if (code === "INVALID_SECONDARY_PHONE") return { ok: false, fieldErrors: { secondaryPhone: PHONE_HELP } };
  if (code === "INVALID_VOUCHER") return { ok: false, fieldErrors: { voucher: `${which} không hợp lệ hoặc đã hết hạn.` } };
  if (code === "VOUCHER_EXHAUSTED") return { ok: false, fieldErrors: { voucher: `${which} đã hết lượt sử dụng.` } };
  if (code === "VOUCHER_ALREADY_USED")
    return { ok: false, fieldErrors: { voucher: `Số điện thoại này đã dùng ${detail ? `mã ${detail}` : "mã này"} rồi.` } };
  if (code === "PRICE_CHANGED")
    return { ok: false, message: "Tổng tiền vừa thay đổi. Vui lòng kiểm tra lại rồi đặt hàng." };
  const gachaError = gachaMessage(code);
  if (gachaError) return { ok: false, fieldErrors: { voucher: gachaError } };
  if (code === "OUT_OF_STOCK" || code === "PRODUCT_INACTIVE")
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
  const codes = await voucherCodes(input?.vouchers, f.voucher);
  const expectedTotal = typeof input?.expectedTotal === "number" && Number.isFinite(input.expectedTotal) ? input.expectedTotal : undefined;

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
    p_voucher_codes: codes,
    p_user_id: claims?.claims.sub,
    p_address_id: addressId,
    // A table quote is left to place_order() (NULL), which computes the same fee itself.
    p_shipping_fee: shipping.source === "spx" ? shipping.fee : undefined,
    p_spx_voucher: shipping.voucherCode ?? undefined,
    p_delivery_method: deliveryMethod,
    p_gacha_code: gachaCode,
    p_gacha_player: gachaPlayer,
    p_expected_total: expectedTotal,
  });
  if (error) {
    if (!/^[A-Z_]+(:|$)/.test(error.message)) console.error("place_order failed", error);
    if (error.message.startsWith("PRICE_CHANGED:") && expectedTotal !== undefined) {
      return priceChanged(expectedTotal, Number(error.message.split(":")[1]), input?.flashWindowStart ?? null);
    }
    return explain(error.message);
  }

  const order = data as {
    order_id: string; order_number: string; subtotal: number; discount: number; gacha_discount: number; gacha_gift: string | null;
    shipping_fee: number; shipping_discount: number; gift_qty: number; total: number;
  };

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
  after(() => sendMetaPurchase(order.order_id));

  return {
    ok: true,
    order: {
      orderNumber: order.order_number,
      subtotal: order.subtotal,
      discount: order.discount,
      gachaDiscount: order.gacha_discount,
      gachaGift: order.gacha_gift,
      shippingFee: order.shipping_fee - order.shipping_discount,
      shippingFeeBeforeDiscount: order.shipping_fee,
      shippingDiscount: order.shipping_discount,
      giftQty: order.gift_qty,
      total: order.total,
      phone: normalizePhone(f.phone)!,
      deliveryMethod,
      paymentMethod,
    },
  };
}

// The total moved between the page's quote and place_order(): say why (design D3b). The page sent
// the flash window it priced with; comparing it with the window now tells "ended" from "started".
async function priceChanged(oldTotal: number, newTotal: number, pageWindow: string | null): Promise<CheckoutResult> {
  const { data } = await createAdminClient().rpc("flash_window");
  const nowWindow = (data as { window_start: string | null } | null)?.window_start ?? null;
  const same = (a: string | null, b: string | null) => (a && b ? Date.parse(a) === Date.parse(b) : a === b);
  const reason: PriceChange["reason"] = same(pageWindow, nowWindow) ? "other" : pageWindow ? "flash_ended" : "flash_started";
  const message = reason === "flash_ended" ? "Flash sale vừa kết thúc, tổng tiền đã thay đổi."
    : reason === "flash_started" ? "Flash sale vừa bắt đầu, bạn được giá tốt hơn!"
    : "Tổng tiền vừa thay đổi.";
  return { ok: false, message: `${message} Vui lòng kiểm tra lại rồi đặt hàng.`, priceChanged: { reason, oldTotal, newTotal } };
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

// The first block keeps the shape today's checkout page reads (prices at LIST price, with the
// flash saving as its own line, so the page's own list subtotal − discount still gives the total).
// The rest is pricing v2, for the voucher picker (ARCHITECTURE.md §5, design D6).
export type OrderQuote = {
  subtotal: number; // list prices
  discount: number; // flash saving + combo + vouchers
  source: "auto_first5" | "promo" | "bundle" | null; // "auto_first5" no longer happens (pricing v2)
  pct: number | null;
  code: string | null;
  flashPct: number | null;
  flashDiscount: number | null;
  bundles: { name: string; sets: number }[];
  phoneKnown: boolean;
  voucherError: string | null;
  // pricing v2
  chargedSubtotal: number; // flash prices included; what `combo` and `vouchers` apply to
  lines: { variantId: string; qty: number; listPrice: number; price: number; flash: boolean }[];
  combo: number;
  vouchers: { code: string; type: "standing" | "promo"; pct: number; amount: number }[];
  voucherErrors: { code: string; message: string }[];
  availableVouchers: { code: string; type: "standing" | "promo"; pct: number; capAmount: number | null; expiresAt: string | null }[];
  freeShipping: boolean; // the page shows shipping as ₫0 when true
  gift: { eligible: boolean; inStock: boolean };
  flashWindowStart: string | null; // send back with placeOrder (with expectedTotal)
};

// Checkout preview of the discount (client, 2026-10-11): quote_order() runs the same
// order_discount() as place_order(), without touching stock. No valid phone yet = no
// once-per-phone check. Display only — place_order() decides at submit. null = can't quote now
// (rate limited or failed): the page falls back to "applied at checkout". Rate limited per IP +
// phone so it can't be used to try promo codes faster than placing orders would allow by much.
export async function quoteOrder(input: {
  items: CheckoutInput["items"]; phone: string; voucher: string; vouchers?: string[]; deliveryMethod?: string;
}): Promise<OrderQuote | null> {
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
    // Gacha prize codes are quoted separately (quoteGachaCode); voucherCodes() leaves them out.
    p_voucher_codes: await voucherCodes(input?.vouchers, voucher),
    p_delivery_method: input?.deliveryMethod === "express" ? "express" : "standard",
  });
  if (error) {
    if (!/^[A-Z_]+(:|$)/.test(error.message)) console.error("quote_order failed", error);
    return null;
  }
  const q = data as {
    list_subtotal: number; subtotal: number; discount: number; combo: number; flash_pct: number | null;
    bundles: { name: string; sets: number }[] | null; phone_known: boolean; flash_window_start: string | null;
    lines: { variant_id: string; qty: number; list_price: number; price: number; flash: boolean }[];
    vouchers: { code: string; type: "standing" | "promo"; pct: number; amount: number }[];
    voucher_errors: { code: string; error: string }[];
    available_vouchers: { code: string; type: "standing" | "promo"; pct: number; cap_amount: number | null; expires_at: string | null }[];
    free_shipping: boolean; gift: { eligible: boolean; in_stock: boolean };
  };
  const flashSaving = q.list_subtotal - q.subtotal;
  const voucherTotal = q.vouchers.reduce((sum, v) => sum + v.amount, 0);
  const base = q.subtotal - q.combo;
  return {
    subtotal: q.list_subtotal,
    discount: flashSaving + q.discount,
    // Today's page shows one label: the codes ("PDZWELCOME, SALE15") with their combined %.
    source: q.vouchers.length ? "promo" : q.combo > 0 ? "bundle" : null,
    pct: q.vouchers.length ? (q.vouchers.length === 1 ? q.vouchers[0].pct : Math.round((voucherTotal / Math.max(base, 1)) * 100)) : null,
    code: q.vouchers.length ? q.vouchers.map((v) => v.code).join(", ") : null,
    flashPct: flashSaving > 0 ? q.flash_pct : null,
    flashDiscount: flashSaving > 0 ? flashSaving : null,
    bundles: (q.bundles ?? []).map((b) => ({ name: b.name, sets: b.sets })),
    phoneKnown: q.phone_known,
    voucherError: q.voucher_errors.length ? voucherMessage(`${q.voucher_errors[0].error}:${q.voucher_errors[0].code}`) : null,
    chargedSubtotal: q.subtotal,
    lines: q.lines.map((l) => ({ variantId: l.variant_id, qty: l.qty, listPrice: l.list_price, price: l.price, flash: l.flash })),
    combo: q.combo,
    vouchers: q.vouchers.map((v) => ({ code: v.code, type: v.type, pct: v.pct, amount: v.amount })),
    voucherErrors: q.voucher_errors.map((e) => ({ code: e.code, message: voucherMessage(`${e.error}:${e.code}`) ?? e.error })),
    availableVouchers: q.available_vouchers.map((v) => ({ code: v.code, type: v.type, pct: v.pct, capAmount: v.cap_amount, expiresAt: v.expires_at })),
    freeShipping: q.free_shipping,
    gift: { eligible: q.gift.eligible, inStock: q.gift.in_stock },
    flashWindowStart: q.flash_window_start,
  };
}

export type GachaQuote =
  | { ok: true; prizeType: string; tier: string; discount: number; freeship: boolean; gift: string | null }
  | { ok: false; message: string };

// Checkout preview of a gacha prize code (GACHA-…): gacha_quote_code() prices
// the cart from the database and reports the effect — a money discount, free
// shipping, or a physical gift. Display only; place_order() re-validates and
// redeems at submit. null = can't quote now (rate limited or failed).
export async function quoteGachaCode(input: {
  items: CheckoutInput["items"]; code: string; deliveryMethod?: string; phone?: string; voucher?: string; vouchers?: string[];
}): Promise<GachaQuote | null> {
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
  // Pricing v2: an order that already ships free (₫199.000+ after the vouchers) doesn't use a
  // freeship prize; place_order() keeps the code unused. quote_order() applies the same rule.
  if (q.freeship) {
    const phone = typeof input?.phone === "string" ? input.phone.trim().slice(0, 20) : "";
    const voucher = typeof input?.voucher === "string" ? input.voucher.trim().slice(0, 30) : "";
    const { data: quote, error: quoteError } = await createAdminClient().rpc("quote_order", {
      p_items: items.map((i) => ({ variant_id: i.variantId, qty: i.qty })),
      p_phone: phone || undefined,
      p_voucher_codes: await voucherCodes(input?.vouchers, voucher),
      p_delivery_method: input?.deliveryMethod === "express" ? "express" : "standard",
    });
    if (quoteError) {
      console.error("quote_order failed", quoteError);
      return null;
    }
    if ((quote as { free_shipping: boolean }).free_shipping)
      return { ok: false, message: "Đơn này đã được miễn phí vận chuyển. Mã freeship được giữ lại cho đơn sau." };
  }
  return {
    ok: true,
    prizeType: q.prize_type ?? "",
    tier: q.tier ?? "",
    discount: q.discount ?? 0,
    freeship: !!q.freeship,
    gift: q.gift ?? null,
  };
}
