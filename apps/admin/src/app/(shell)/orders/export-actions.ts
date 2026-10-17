"use server";

import { createAdminClient } from "@paranoidz/db/admin";
import { requireAdmin } from "@/lib/auth";
import type { XlsxFile } from "@/lib/download";
import { fetchAll, ordersXlsx, vnDayRange, type OrderRow } from "@/lib/exports/records";
import { isOrderStatus } from "@/lib/order-status";
import { searchFilter } from "@/lib/order-search";

// "XUẤT EXCEL" on /orders (spec: docs/superpowers/specs/2026-10-17-orders-customers-excel-export-design.md).
// Personal data: built per request on the server, sent to the admin's browser, never stored.
const SELECT =
  "order_number, created_at, status, recipient_name, phone, secondary_phone, email, address, ward, city, note, " +
  "subtotal, discount, shipping_fee, total, spx_tracking_no, user_id, " +
  "order_items(sku_snapshot, name_snapshot, color_snapshot, size_snapshot, qty, price_snapshot), " +
  "order_status_history(status, created_at), voucher_uses(vouchers(code, type))";

export async function exportOrders(input: { from: string; to: string; status: string | null; q: string }): Promise<{ file?: XlsxFile; error?: string }> {
  await requireAdmin();
  const range = vnDayRange(String(input?.from), String(input?.to));
  if (!range) return { error: "Ngày bắt đầu phải trước ngày kết thúc." };
  const status = isOrderStatus(input.status) ? input.status : null;
  const q = typeof input.q === "string" ? input.q.trim().slice(0, 50) : "";

  try {
    const admin = createAdminClient();
    const orders = await fetchAll((from, to) => {
      let query = admin.from("orders").select(SELECT)
        .gte("created_at", range.gte).lt("created_at", range.lt)
        .order("created_at", { ascending: false }).order("id")
        .range(from, to);
      if (status) query = query.eq("status", status);
      if (q) query = query.or(searchFilter(q));
      return query.overrideTypes<OrderRow[], { merge: false }>();
    });
    if (!orders.length) return { error: "Không có đơn nào trong khoảng này." };
    const name = `Paranoidz_don-hang_${input.from.replaceAll("-", "")}-${input.to.replaceAll("-", "")}.xlsx`;
    return { file: { name, base64: (await ordersXlsx(orders)).toString("base64") } };
  } catch {
    return { error: "Không thể xuất file. Vui lòng thử lại." };
  }
}
