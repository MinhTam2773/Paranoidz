// ₫ with dot thousands separators: 269000 → "₫269.000" (CLAUDE.md §5).
// Regex, not Intl, so output never depends on the runtime's ICU data.
export function formatVnd(amount: number) {
  return "₫" + String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// "0901234567" → "0901 234 567". Phones are stored normalized; anything else is shown as is.
export function formatPhone(phone: string) {
  return /^0\d{9}$/.test(phone) ? `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}` : phone;
}

// dd/mm/yyyy HH:mm, 24h, Vietnam time (DASHBOARD_DESIGN.md §1).
const dateTime = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Ho_Chi_Minh",
});
export function formatDateTime(iso: string) {
  return dateTime.format(new Date(iso)).replace(",", "");
}

// Vietnam is UTC+7 all year (no DST), so local midnight / month start are fixed offsets.
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

// Vietnam calendar date as "yyyy-mm-dd" (the value of an <input type="date">).
export function vnDate(iso: string | Date = new Date()) {
  return new Date(new Date(iso).getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}
// "yyyy-mm-dd" → dd/mm/yyyy.
export function formatDate(ymd: string) {
  return ymd.split("-").reverse().join("/");
}
export function vnStartOf(unit: "day" | "month", now = new Date()) {
  const vn = new Date(now.getTime() + VN_OFFSET_MS);
  const start = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), unit === "day" ? vn.getUTCDate() : 1);
  return new Date(start - VN_OFFSET_MS).toISOString();
}

// "Vừa xong", "5 phút trước", "3 giờ trước", "2 ngày trước"; older than a week → the date.
export function timeAgo(iso: string, now = Date.now()) {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} giờ trước`;
  if (minutes < 7 * 24 * 60) return `${Math.floor(minutes / (24 * 60))} ngày trước`;
  return formatDateTime(iso);
}
