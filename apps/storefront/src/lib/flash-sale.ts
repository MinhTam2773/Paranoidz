// Flash sale (2026-10-16): daily windows from public.flash_sale_windows, evaluated in
// Asia/Ho_Chi_Minh. During an active window every price gets the window's extra discount.
// Used by the homepage section, the cart page and place_order() — the server always
// recomputes, so the browser can never fake the discount.

export type FlashSaleWindow = {
  start_hour: number;
  duration_minutes: number;
  discount_percent: number;
};

export type FlashSaleState =
  | { active: true; discountPercent: number; endsAt: number }
  | { active: false; nextStartsAt: number; nextHour: number; discountPercent: number };

const VN_OFFSET_MS = 7 * 3600 * 1000;

export function getFlashSaleState(windows: FlashSaleWindow[], nowMs = Date.now()): FlashSaleState | null {
  const enabled = windows
    .filter((w) => w.discount_percent > 0 && w.duration_minutes > 0)
    .sort((a, b) => a.start_hour - b.start_hour);
  if (!enabled.length) return null;

  // VN wall-clock date for "today".
  const vn = new Date(nowMs + VN_OFFSET_MS);
  const vnMidnightUtc = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()) - VN_OFFSET_MS;

  for (const w of enabled) {
    const start = vnMidnightUtc + w.start_hour * 3600_000;
    const end = start + w.duration_minutes * 60_000;
    if (nowMs >= start && nowMs < end) {
      return { active: true, discountPercent: w.discount_percent, endsAt: end };
    }
  }
  for (const w of enabled) {
    const start = vnMidnightUtc + w.start_hour * 3600_000;
    if (start > nowMs) {
      return { active: false, nextStartsAt: start, nextHour: w.start_hour, discountPercent: w.discount_percent };
    }
  }
  const first = enabled[0];
  return {
    active: false,
    nextStartsAt: vnMidnightUtc + 24 * 3600_000 + first.start_hour * 3600_000,
    nextHour: first.start_hour,
    discountPercent: first.discount_percent,
  };
}

/** Extra flash discount on the current selling price, rounded to the nearest 1.000₫. */
export function flashPrice(price: number, discountPercent: number): number {
  return Math.max(0, Math.round((price * (1 - discountPercent / 100)) / 1000) * 1000);
}
