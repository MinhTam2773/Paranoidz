"use server";

import { createAdminClient } from "@paranoidz/db/admin";
import { requireAdmin } from "@/lib/auth";
import { customerSearch } from "@/lib/customer-search";
import type { XlsxFile } from "@/lib/download";
import { customerSheet, customersXlsx, fetchAll } from "@/lib/exports/records";

// "XUẤT EXCEL" on /customers (spec: docs/superpowers/specs/2026-10-17-orders-customers-excel-export-design.md).
// All customers, or the current search. Personal data: built per request, never stored.
export async function exportCustomers(input: { q: string }): Promise<{ file?: XlsxFile; error?: string }> {
  await requireAdmin();
  const q = typeof input?.q === "string" ? input.q.trim().slice(0, 100) : "";

  try {
    const admin = createAdminClient();
    const filter = q ? await customerSearch(admin, q) : null;
    const customers = await fetchAll((from, to) => {
      let query = admin.from("customers").select("phone, delivered_count, refusal_count, is_blacklisted")
        .order("created_at", { ascending: false }).order("phone")
        .range(from, to);
      if (filter) query = "like" in filter ? query.like("phone", filter.like) : query.in("phone", filter.phones);
      return query;
    });
    if (!customers.length) return { error: "Không có khách hàng nào để xuất." };

    const [orders, accounts] = await Promise.all([
      fetchAll((from, to) => {
        let query = admin.from("orders").select("phone, recipient_name, email, address, ward, city, status, total, created_at")
          .order("created_at").order("id")
          .range(from, to);
        if (filter) query = query.in("phone", customers.map((c) => c.phone));
        return query;
      }),
      fetchAll((from, to) => admin.from("profiles").select("phone, full_name").not("phone", "is", null).order("id").range(from, to)),
    ]);
    const rows = customerSheet(customers, orders, new Map(accounts.map((a) => [a.phone!, a.full_name])));
    // Vietnam time (UTC+7, no DST): 20261017-1530
    const stamp = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-");
    return { file: { name: `Paranoidz_khach-hang_${stamp}.xlsx`, base64: (await customersXlsx(rows)).toString("base64") } };
  } catch {
    return { error: "Không thể xuất file. Vui lòng thử lại." };
  }
}
