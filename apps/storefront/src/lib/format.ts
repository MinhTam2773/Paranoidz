// ₫ with dot thousands separators: 269000 → "₫269.000" (CLAUDE.md §5, DESIGN.md §4).
// Regex, not Intl, so output never depends on the runtime's ICU data.
export function formatVnd(amount: number) {
  return "₫" + String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
