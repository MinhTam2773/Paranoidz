// Website → BigSeller: files for Inventory → Manual Stock-Out / Manual Stock-In → Import & Update.
// Headers are copied from BigSeller's own templates (sheet "SKU"), byte for byte — the Vietnamese-UI
// ones (nhập_phiếu_xuất_kho_vn.xlsx / nhập_phiếu_nhập_kho_vn.xlsx, 2026-10-14). Same columns and order
// as the English templates. Not yet confirmed by a real upload (TODO.md).
import writeXlsxFile from "write-excel-file/node";

export const STOCK_OUT_HEADER = ["*Mã SKU", "*Số lượng xuất kho", "Số seri"] as const;
export const STOCK_IN_HEADER = [
  "*Mã SKU\n(Điều SKU hoặc GTIN)", "*GTIN\n(Điều SKU hoặc GTIN)", "*Số lượng nhập kho",
  "Đơn giá", "Ngày sản xuất", "Ngày hết hạn", "Số seri",
] as const;
export const MAX_LINES = 2000; // BigSeller: up to 2,000 lines per file

export type Line = { sku: string; qty: number };
type Row = (string | number | null)[];

export function aggregateLines(lines: Line[]): Line[] {
  const sums = new Map<string, number>();
  for (const l of lines) sums.set(l.sku, (sums.get(l.sku) ?? 0) + l.qty);
  return [...sums].filter(([, qty]) => qty > 0).map(([sku, qty]) => ({ sku, qty }));
}

export function stockOutRows(lines: Line[]): Row[] {
  return [[...STOCK_OUT_HEADER], ...lines.map((l) => [l.sku, l.qty, null])];
}

export function stockInRows(lines: Line[]): Row[] {
  return [[...STOCK_IN_HEADER], ...lines.map((l) => [l.sku, null, l.qty, null, null, null, null])];
}

export function chunk<T>(items: T[], size = MAX_LINES): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function toXlsx(rows: Row[]) {
  return writeXlsxFile(rows, { sheet: "SKU" }).toBuffer();
}
