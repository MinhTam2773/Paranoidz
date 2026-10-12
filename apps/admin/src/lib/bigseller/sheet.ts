// Shared helpers for reading BigSeller's Excel exports (rows as read-excel-file returns them).

export type Cell = string | number | boolean | Date | null | undefined;

export function text(cell: Cell) {
  return cell === null || cell === undefined ? "" : String(cell).trim();
}

// Column index by header name; BigSeller files are matched by header, never by position.
export function columns<const H extends readonly string[]>(header: Cell[] | undefined, required: H) {
  const names = (header ?? []).map(text);
  const index = Object.fromEntries(required.map((h) => [h, names.indexOf(h)])) as Record<H[number], number>;
  const missing = required.filter((h) => names.indexOf(h) < 0);
  return { index, missing };
}

export const missingColumns = (file: string, missing: readonly string[]) =>
  `${file}: không tìm thấy cột ${missing.map((m) => `"${m}"`).join(", ")}. Hãy xuất lại file từ BigSeller (giao diện tiếng Anh).`;

// "27.0", "27", 27 → 27; anything else (27.5, -1, "abc") → NaN.
export function wholeNumber(cell: Cell) {
  const s = text(cell);
  return /^\d+(\.0+)?$/.test(s) ? Number(s) : NaN;
}
