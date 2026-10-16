import { createAdminClient } from "@paranoidz/db/admin";
import { PROVINCES } from "@paranoidz/db/provinces";
import { env, spxUserCall } from "@paranoidz/db/spx";
import { checkOrderBody, cheapestQuote } from "@paranoidz/db/spx/order-body";

// Checkout shipping fee (ARCHITECTURE.md §5 "SPX Open API"): SPX's live price with the best
// currently valid account voucher, else the shipping_fee() table. SPX gets 3 s in total; an error,
// a timeout or a fee above place_order()'s bound (3 × table) means the table fee, so checkout
// never blocks on SPX. SPX answers are cached per server instance for 5 minutes, which also keeps
// the fee charged at submit equal to the one the checkout showed. null = no fee for this city.
export type ShippingQuote = { fee: number; voucherCode: string | null; source: "spx" | "table" };

const BUDGET_MS = 3000;
const CACHE_MS = 5 * 60_000;
const MAX_FACTOR = 3; // same bound as place_order()

type Voucher = { voucher_code: string; valid_start_time: number; valid_end_time: number };
type Checked = { orders?: { order_id: string; estimated_shipping_fee: number }[] };
let vouchers: { at: number; list: Voucher[] } | null = null;
const quotes = new Map<string, { at: number; quote: ShippingQuote }>();

async function voucherCodes(signal: AbortSignal) {
  if (!vouchers || Date.now() - vouchers.at > CACHE_MS) {
    const data = await spxUserCall<{ vouchers?: Voucher[] }>("v1/order/list_voucher", {}, signal);
    vouchers = { at: Date.now(), list: data.vouchers ?? [] };
  }
  const now = Date.now() / 1000;
  return vouchers.list.filter((v) => v.valid_start_time <= now && now < v.valid_end_time).map((v) => v.voucher_code);
}

async function spxQuote(province: string, ward: string, units: number, value: number) {
  const signal = AbortSignal.timeout(BUDGET_MS);
  const sender = { province: env("SPX_SENDER_PROVINCE"), ward: env("SPX_SENDER_WARD") };
  const check = (orders: object[]) =>
    spxUserCall<Checked>("v1/order/batch_check_order", { orders }, signal).then(
      (data) => data.orders ?? [],
      (e) => (console.error("SPX fee check failed", e), []),
    );
  // The plain price never waits for the voucher list. One voucher SPX no longer knows fails its
  // whole batch, so the voucher prices are a separate call.
  const plain = check([checkOrderBody("none", province, ward, units, value, sender)]);
  const codes = await voucherCodes(signal).catch((e) => (console.error("SPX voucher list failed", e), [] as string[]));
  const discounted = codes.length ? await check(codes.map((code, i) => checkOrderBody(`v${i}`, province, ward, units, value, sender, code))) : [];
  return cheapestQuote([...(await plain), ...discounted], (id) => (id === "none" ? null : codes[Number(id.slice(1))]));
}

// `value` = the order's subtotal from database prices (SPX's COD amount + declared value).
// live = false skips SPX (rate-limited previews); so does an environment without SPX keys (CI).
export async function quoteShipping(city: string, ward: string, units: number, value: number, live = true): Promise<ShippingQuote | null> {
  const province = PROVINCES.find((p) => p.name === city)?.spx;
  const key = `${province}|${ward}|${units}|${value}`;
  const cached = quotes.get(key);
  if (province && cached && Date.now() - cached.at < CACHE_MS) return cached.quote;

  const [{ data: table, error }, spx] = await Promise.all([
    createAdminClient().rpc("shipping_fee", { p_city: city, p_units: units }),
    live && process.env.SPX_API_HOST && province && ward ? spxQuote(province, ward, units, value).catch((e) => (console.error("SPX quote failed", e), null)) : null,
  ]);
  if (error) return null;
  const fallback: ShippingQuote = { fee: table, voucherCode: null, source: "table" };
  if (!spx) return fallback;
  if (spx.fee > MAX_FACTOR * table) {
    console.error("SPX fee above 3 × table, using the table", { key, fee: spx.fee, table });
    return fallback;
  }
  const quote: ShippingQuote = { ...spx, source: "spx" };
  if (quotes.size >= 1000) quotes.clear();
  quotes.set(key, { at: Date.now(), quote });
  return quote;
}
