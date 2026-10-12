// BigSeller Inventory → Inventory List → Import & Export → Export All (sheet "Single SKU").
import { normalizeSku } from "./sku.ts";
import { columns, missingColumns, text, wholeNumber, type Cell } from "./sheet.ts";

const FILE = "File tồn kho";
const MAX_ROWS = 5000;
const REQUIRED = ["SKU Name", "Title", "Image URL", "Warehouse", "Available for whole warehouse", "SKU Type"] as const;

export type InventoryRow = { sku: string; title: string; imageUrl: string | null; warehouse: string; available: number };
export type InventoryParse = { rows: InventoryRow[]; skipped: string[]; errors: string[] };

export function parseInventorySheet(data: Cell[][]): InventoryParse {
  const { index, missing } = columns(data[0], REQUIRED);
  if (!data.length) return { rows: [], skipped: [], errors: [`${FILE} trống.`] };
  if (missing.length) return { rows: [], skipped: [], errors: [missingColumns(FILE, missing)] };
  if (data.length - 1 > MAX_ROWS) return { rows: [], skipped: [], errors: [`${FILE}: tối đa ${MAX_ROWS} dòng.`] };

  const rows: InventoryRow[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  data.slice(1).forEach((r, i) => {
    const sku = normalizeSku(text(r[index["SKU Name"]]));
    if (!sku) return; // blank line
    if (text(r[index["SKU Type"]]) !== "Single SKU") return void skipped.push(sku);
    const line = `Dòng ${i + 2} (${sku})`;
    const available = wholeNumber(r[index["Available for whole warehouse"]]);
    if (Number.isNaN(available)) return void errors.push(`${line}: số lượng "${text(r[index["Available for whole warehouse"]])}" không hợp lệ.`);
    if (seen.has(sku)) return void errors.push(`${line}: SKU trùng với một dòng khác.`);
    seen.add(sku);
    // The URL serves a 300×300 thumbnail; without the query string it serves the original.
    const image = text(r[index["Image URL"]]).split("?")[0];
    rows.push({ sku, title: text(r[index.Title]), imageUrl: image || null, warehouse: text(r[index.Warehouse]), available });
  });

  if (new Set(rows.map((r) => r.warehouse)).size > 1) {
    errors.push(`${FILE} có nhiều kho. Chỉ xuất kho mặc định (lọc theo một kho trước khi xuất).`);
  }
  if (!rows.length && !errors.length) errors.push(`${FILE} không có SKU nào.`);
  return { rows, skipped, errors };
}

// Inventory_List20261012172745857.xlsx → 2026-10-12T17:27:45.857Z (BigSeller names exports in UTC).
export function fileTimestamp(name: string): Date | null {
  const m = /Inventory_List(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{3})/.exec(name);
  if (!m) return null;
  const [y, mo, d, h, mi, s, ms] = m.slice(1).map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi, s, ms));
  return Number.isNaN(date.getTime()) ? null : date;
}
