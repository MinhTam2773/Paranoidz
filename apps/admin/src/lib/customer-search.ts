import type { createAdminClient } from "@paranoidz/db/admin";

// /customers search, shared by the list and its Excel export: a name → the phones whose orders or
// account carry it (.ilike = one filter value, no injection); otherwise a phone fragment.
// Nothing searchable → a phone list that matches nothing.
export async function customerSearch(admin: ReturnType<typeof createAdminClient>, q: string): Promise<{ like: string } | { phones: string[] }> {
  let digits = q.replace(/\D/g, "");
  if (/^84\d{9}$/.test(digits)) digits = "0" + digits.slice(2);
  if (/\p{L}/u.test(q)) {
    const [byOrder, byAccount] = await Promise.all([
      admin.from("orders").select("phone").ilike("recipient_name", `%${q}%`).limit(500),
      admin.from("profiles").select("phone").ilike("full_name", `%${q}%`).not("phone", "is", null).limit(500),
    ]);
    const phones = [...new Set([...(byOrder.data ?? []), ...(byAccount.data ?? [])].map((r) => r.phone!))];
    return { phones: phones.length ? phones : ["-"] };
  }
  return digits.length >= 3 ? { like: `%${digits}%` } : { phones: ["-"] };
}
