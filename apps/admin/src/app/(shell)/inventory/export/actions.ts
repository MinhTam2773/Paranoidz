"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@paranoidz/db/admin";
import { requireAdmin } from "@/lib/auth";
import { aggregateLines, chunk, stockInRows, stockOutRows, toXlsx, type Line } from "@/lib/bigseller/stock-files";

// Website → BigSeller (spec: docs/superpowers/specs/2026-10-12-bigseller-inventory-sync-design.md).
// Stock-out: confirmed / shipped / delivered orders not yet exported + negative adjustments.
// Stock-in: exported orders that were then cancelled / refused + positive adjustments.
// Pending orders wait until confirmed (they're already counted as "unsent" by the import).

export type ExportOrder = { id: string; number: string; status: string; lines: { sku: string | null; qty: number; label: string }[] };
export type ExportAdjustment = { id: string; sku: string; delta: number; reason: string | null; createdAt: string };
export type ExportBatch = { out: string[]; back: string[]; adjustments: string[] };
export type ExportData = {
  outOrders: ExportOrder[];
  backOrders: ExportOrder[];
  blocked: ExportOrder[]; // an item without SKU: can't be sent until the variant has one
  minus: ExportAdjustment[];
  plus: ExportAdjustment[];
  outLines: Line[];
  inLines: Line[];
  pendingOrders: number;
  batch: ExportBatch;
};

const ITEMS = "id, order_number, status, order_items(sku_snapshot, qty, name_snapshot, color_snapshot, size_snapshot)";

export async function loadExport(): Promise<ExportData> {
  await requireAdmin();
  const admin = createAdminClient();
  const [out, back, adj, pending] = await Promise.all([
    admin.from("orders").select(ITEMS).is("bigseller_exported_at", null).in("status", ["confirmed", "shipped", "delivered"]).order("created_at"),
    admin.from("orders").select(ITEMS).not("bigseller_exported_at", "is", null).is("bigseller_restocked_at", null).in("status", ["cancelled", "delivery_failed"]).order("created_at"),
    admin.from("stock_adjustments").select("id, sku_snapshot, delta, reason, created_at").is("exported_at", null).order("created_at"),
    admin.from("orders").select("id", { count: "exact", head: true }).is("bigseller_exported_at", null).eq("status", "pending"),
  ]);
  for (const r of [out, back, adj, pending]) if (r.error) throw r.error;

  const view = (o: NonNullable<typeof out.data>[number]): ExportOrder => ({
    id: o.id, number: o.order_number, status: o.status,
    lines: o.order_items.map((i) => ({ sku: i.sku_snapshot, qty: i.qty, label: `${i.name_snapshot} · ${i.color_snapshot ?? ""} / ${i.size_snapshot ?? ""}` })),
  });
  const sendable = (o: ExportOrder) => o.lines.every((l) => !!l.sku);
  const outAll = (out.data ?? []).map(view);
  const backAll = (back.data ?? []).map(view);
  const outOrders = outAll.filter(sendable);
  const backOrders = backAll.filter(sendable);
  const adjustments = (adj.data ?? []).map((a) => ({ id: a.id, sku: a.sku_snapshot, delta: a.delta, reason: a.reason, createdAt: a.created_at }));
  const minus = adjustments.filter((a) => a.delta < 0);
  const plus = adjustments.filter((a) => a.delta > 0);
  const lines = (orders: ExportOrder[]) => orders.flatMap((o) => o.lines.map((l) => ({ sku: l.sku!, qty: l.qty })));

  return {
    outOrders, backOrders, minus, plus,
    blocked: [...outAll, ...backAll].filter((o) => !sendable(o)),
    outLines: aggregateLines([...lines(outOrders), ...minus.map((a) => ({ sku: a.sku, qty: -a.delta }))]),
    inLines: aggregateLines([...lines(backOrders), ...plus.map((a) => ({ sku: a.sku, qty: a.delta }))]),
    pendingOrders: pending.count ?? 0,
    batch: { out: outOrders.map((o) => o.id), back: backOrders.map((o) => o.id), adjustments: adjustments.map((a) => a.id) },
  };
}

export type ExportFile = { name: string; base64: string; lines: number };

// Builds the files from a fresh read; the returned batch is exactly what is in them.
export async function buildExport(): Promise<{ batch: ExportBatch; files: ExportFile[] }> {
  const data = await loadExport();
  // Vietnam time (UTC+7, no DST): 20261012-1530
  const stamp = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-");
  const files: ExportFile[] = [];
  const add = async (kind: string, lines: Line[], rows: (l: Line[]) => (string | number | null)[][]) => {
    const parts = chunk(lines);
    for (const [i, part] of parts.entries()) {
      const name = `Paranoidz_${kind}_${stamp}${parts.length > 1 ? `_${i + 1}` : ""}.xlsx`;
      files.push({ name, base64: (await toXlsx(rows(part))).toString("base64"), lines: part.length });
    }
  };
  await add("xuat-kho", data.outLines, stockOutRows);
  await add("nhap-kho", data.inLines, stockInRows);
  return { batch: data.batch, files };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ids = (x: unknown) => (Array.isArray(x) && x.length <= 10_000 && x.every((v) => typeof v === "string" && UUID.test(v)) ? (x as string[]) : null);

// "ĐÃ NHẬP VÀO BIGSELLER": mark exactly the downloaded batch (mark_bigseller_sent sets each once).
export async function confirmExport(batch: ExportBatch): Promise<{ error?: string; counts?: { out: number; back: number; adjustments: number } }> {
  await requireAdmin();
  const [out, back, adjustments] = [ids(batch?.out), ids(batch?.back), ids(batch?.adjustments)];
  if (!out || !back || !adjustments) return { error: "Dữ liệu không hợp lệ. Tải lại trang." };
  const { data, error } = await createAdminClient().rpc("mark_bigseller_sent", { p_out: out, p_back: back, p_adjustments: adjustments });
  if (error) return { error: "Không thể đánh dấu. Vui lòng thử lại." };
  revalidatePath("/inventory", "layout");
  return { counts: data as { out: number; back: number; adjustments: number } };
}
