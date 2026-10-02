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
