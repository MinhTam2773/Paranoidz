// /orders search, shared by the list and its Excel export.
// Order number or phone. Only [A-Z0-9-] / digits reach the PostgREST filter, so
// the input can't inject filter syntax. "+84 90…" matches the stored "090…".
export function searchFilter(q: string) {
  const term = q.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  let digits = q.replace(/\D/g, "");
  if (/^84\d{9}$/.test(digits)) digits = "0" + digits.slice(2);
  const parts: string[] = [];
  if (term) parts.push(`order_number.ilike.*${term}*`);
  if (digits.length >= 3) parts.push(`phone.like.*${digits}*`);
  // Nothing searchable left → match nothing rather than everything.
  return parts.join(",") || "id.is.null";
}
