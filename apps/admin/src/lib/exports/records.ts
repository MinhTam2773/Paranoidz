// Orders / customers Excel files for the client's own records (spec:
// docs/superpowers/specs/2026-10-17-orders-customers-excel-export-design.md). Never imported anywhere.
// Pure: no Next / Supabase imports, so `node --test` can load it.
import writeXlsxFile from "write-excel-file/node";
import { STATUS_LABEL, type OrderStatus } from "../order-status.ts";

export const ORDER_HEADER = [
  "Mã đơn", "Ngày đặt", "Trạng thái", "Ngày giao / hủy", "Người nhận", "SĐT", "SĐT phụ", "Email",
  "Địa chỉ", "Phường / xã", "Tỉnh / TP", "Ghi chú", "Số SP", "Tạm tính (₫)", "Giảm giá (₫)",
  "Mã giảm giá", "Phí ship (₫)", "Tổng thu COD (₫)", "Mã vận đơn SPX", "Có tài khoản",
] as const;
export const ITEM_HEADER = [
  "Mã đơn", "Ngày đặt", "Trạng thái", "SKU", "Tên SP", "Màu", "Size", "SL", "Đơn giá (₫)", "Thành tiền (₫)",
] as const;
export const CUSTOMER_HEADER = [
  "SĐT", "Tên", "Email", "Địa chỉ gần nhất", "Số đơn", "Đã giao", "Bom hàng", "Bị chặn",
  "Tổng đã mua (₫)", "Đơn đầu tiên", "Đơn gần nhất", "Có tài khoản",
] as const;

// The shape the export actions select from Supabase.
export type OrderRow = {
  order_number: string; created_at: string; status: OrderStatus;
  recipient_name: string; phone: string; secondary_phone: string | null; email: string | null;
  address: string; ward: string | null; city: string; note: string | null;
  subtotal: number; discount: number; shipping_fee: number; total: number;
  spx_tracking_no: string | null; user_id: string | null;
  order_items: { sku_snapshot: string | null; name_snapshot: string; color_snapshot: string | null; size_snapshot: string | null; qty: number; price_snapshot: number }[];
  order_status_history: { status: OrderStatus; created_at: string }[];
  voucher_uses: { vouchers: { code: string; type: string } | null }[];
};
export type CustomerRow = { phone: string; delivered_count: number; refusal_count: number; is_blacklisted: boolean };
export type CustomerOrder = {
  phone: string; recipient_name: string; email: string | null; address: string; ward: string | null; city: string;
  status: OrderStatus; total: number; created_at: string;
};

type Cell = { value: string | number | Date; type?: StringConstructor | NumberConstructor | DateConstructor; format?: string; fontWeight?: "bold" } | null;

const VN_OFFSET_MS = 7 * 3600_000;
const text = (v: string | null | undefined): Cell => (v ? { value: v, type: String } : null);
const money = (v: number): Cell => ({ value: v, type: Number, format: "#,##0" });
const count = (v: number): Cell => ({ value: v, type: Number });
// Excel dates have no time zone: shift so the cell shows Vietnam wall-clock time.
const date = (iso: string | null | undefined): Cell =>
  iso ? { value: new Date(new Date(iso).getTime() + VN_OFFSET_MS), type: Date, format: "dd/mm/yyyy hh:mm" } : null;
const header = (h: readonly string[]): Cell[] => h.map((value) => ({ value, fontWeight: "bold" }));
const yes = (b: boolean) => text(b ? "Có" : null);

const CLOSED: OrderStatus[] = ["delivered", "cancelled", "delivery_failed"];

// When the order reached its final status; blank while it's still open.
function closedAt(o: OrderRow) {
  if (!CLOSED.includes(o.status)) return null;
  return o.order_status_history.filter((h) => h.status === o.status).map((h) => h.created_at).sort().at(-1) ?? null;
}

function voucherLabel(o: OrderRow) {
  const v = o.voucher_uses.map((u) => u.vouchers).find((x) => x);
  if (!v) return null;
  return v.type === "auto_first5" ? "5 ĐƠN ĐẦU" : v.code;
}

export function orderSheets(orders: OrderRow[]) {
  const ordersSheet: Cell[][] = [header(ORDER_HEADER)];
  const itemsSheet: Cell[][] = [header(ITEM_HEADER)];
  for (const o of orders) {
    const status = text(STATUS_LABEL[o.status]);
    ordersSheet.push([
      text(o.order_number), date(o.created_at), status, date(closedAt(o)),
      text(o.recipient_name), text(o.phone), text(o.secondary_phone), text(o.email),
      text(o.address), text(o.ward), text(o.city), text(o.note),
      count(o.order_items.reduce((n, i) => n + i.qty, 0)), money(o.subtotal), money(o.discount),
      text(voucherLabel(o)), money(o.shipping_fee), money(o.total), text(o.spx_tracking_no), yes(!!o.user_id),
    ]);
    for (const i of o.order_items) {
      itemsSheet.push([
        text(o.order_number), date(o.created_at), status, text(i.sku_snapshot), text(i.name_snapshot),
        text(i.color_snapshot), text(i.size_snapshot), count(i.qty), money(i.price_snapshot), money(i.price_snapshot * i.qty),
      ]);
    }
  }
  return { orders: ordersSheet, items: itemsSheet };
}

// One row per customer; `orders` are that set of phones' orders, any status; `accounts` maps a
// profile's phone to its name (the /customers list's fallback when no order carries one).
export function customerSheet(customers: CustomerRow[], orders: CustomerOrder[], accounts: Map<string, string | null>) {
  const byPhone = new Map<string, CustomerOrder[]>();
  for (const o of [...orders].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    byPhone.set(o.phone, [...(byPhone.get(o.phone) ?? []), o]); // newest first
  }
  const rows: Cell[][] = [header(CUSTOMER_HEADER)];
  for (const c of customers) {
    const own = byPhone.get(c.phone) ?? [];
    const latest = own[0];
    rows.push([
      text(c.phone), text(latest?.recipient_name ?? accounts.get(c.phone)), text(own.find((o) => o.email)?.email),
      text(latest && [latest.address, latest.ward, latest.city].filter(Boolean).join(", ")),
      count(own.length), count(c.delivered_count), count(c.refusal_count), yes(c.is_blacklisted),
      money(own.filter((o) => o.status === "delivered").reduce((s, o) => s + o.total, 0)),
      date(own.at(-1)?.created_at), date(latest?.created_at), yes(accounts.has(c.phone)),
    ]);
  }
  return rows;
}

// Inclusive Vietnam-date range "yyyy-mm-dd" → [from, to) ISO bounds for created_at; null if invalid.
export function vnDayRange(from: string, to: string) {
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  if (!ymd.test(from) || !ymd.test(to)) return null;
  const start = new Date(`${from}T00:00:00+07:00`);
  const end = new Date(new Date(`${to}T00:00:00+07:00`).getTime() + 86_400_000);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) return null;
  return { gte: start.toISOString(), lt: end.toISOString() };
}

// PostgREST returns at most 1,000 rows per request (max_rows): read pages until a short one.
// `page` must build a fresh, deterministically ordered query for each range.
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  size = 1000,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw error;
    all.push(...(data ?? []));
    if ((data?.length ?? 0) < size) return all;
  }
}

const ORDER_WIDTHS = [14, 16, 14, 16, 22, 12, 12, 24, 30, 20, 18, 24, 7, 12, 12, 14, 12, 14, 16, 8];
const ITEM_WIDTHS = [14, 16, 14, 18, 40, 12, 8, 6, 12, 14];
const CUSTOMER_WIDTHS = [12, 22, 24, 50, 8, 8, 9, 8, 14, 16, 16, 8];
const cols = (w: number[]) => w.map((width) => ({ width }));

export function ordersXlsx(orders: OrderRow[]) {
  const s = orderSheets(orders);
  return writeXlsxFile([
    { data: s.orders, sheet: "Đơn hàng", columns: cols(ORDER_WIDTHS), stickyRowsCount: 1 },
    { data: s.items, sheet: "Sản phẩm", columns: cols(ITEM_WIDTHS), stickyRowsCount: 1 },
  ]).toBuffer();
}

export function customersXlsx(rows: Cell[][]) {
  return writeXlsxFile(rows, { sheet: "Khách hàng", columns: cols(CUSTOMER_WIDTHS), stickyRowsCount: 1 }).toBuffer();
}
