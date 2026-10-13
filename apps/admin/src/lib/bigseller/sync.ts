// BigSeller → website: which stock to set and which products to create.
// Spec "The sync rule": stock = max(0, available − unsent_out + unsent_back + unsent_adj).
import { normalizeSku, parseSku, type ParsedSku } from "./sku.ts";
import type { InventoryRow } from "./inventory-file.ts";
import { slugify } from "../product.ts";

export type Unsent = { out: number; back: number; adj: number };
export const NOTHING_UNSENT: Unsent = { out: 0, back: 0, adj: 0 };

export function targetStock(available: number, unsent: Unsent = NOTHING_UNSENT) {
  return Math.max(0, available - unsent.out + unsent.back + unsent.adj);
}

export type WebVariant = { id: string; sku: string; stock: number };
export type StockUpdate = { variantId: string; sku: string; current: number; available: number; unsent: Unsent; target: number };
export type NewGroup = { code: string; title: string; rows: (InventoryRow & ParsedSku)[] };

// URL slug for a product the import creates. Always ends with the group code, so two
// products with the same Shopee title (pdz01 / pdz08) never collide, even after the
// 80-character cut.
export function productSlug(name: string, code: string) {
  const c = slugify(code);
  const base = slugify(name);
  if (!base || base === c || base.endsWith(`-${c}`)) return base || c;
  return `${base.slice(0, 80 - c.length - 1).replace(/-+$/, "")}-${c}`;
}

// Pre-filled product name: the Shopee title, plus " (code)" when another new product has
// the same title and this one doesn't already end with its own code.
export function defaultName(group: NewGroup, all: NewGroup[]) {
  const title = group.title.trim();
  const shared = all.filter((g) => g.title.trim() === title).length > 1;
  if (!shared || title.toLowerCase().endsWith(group.code.toLowerCase())) return title.slice(0, 120);
  const suffix = ` (${group.code})`;
  return title.slice(0, 120 - suffix.length).trimEnd() + suffix;
}

// Display colour per SKU colour for a new product: Shopee's label when the listings
// file has one (first SKU of that colour with a label), else the SKU's colour. Two
// SKU colours must never end up with the same label (unique colour + size).
export function colorLabels(group: NewGroup, labelBySku: (sku: string) => string | null | undefined) {
  const out = new Map<string, string>();
  for (const r of group.rows) if (!out.has(r.color) || out.get(r.color) === r.color) out.set(r.color, labelBySku(r.sku)?.trim() || r.color);
  const taken = new Map<string, number>();
  for (const label of out.values()) taken.set(label.toLowerCase(), (taken.get(label.toLowerCase()) ?? 0) + 1);
  for (const [color, label] of out) if ((taken.get(label.toLowerCase()) ?? 0) > 1) out.set(color, color);
  return out;
}

export function planImport(fileRows: InventoryRow[], variants: WebVariant[], unsent: Map<string, Unsent>) {
  const bySku = new Map(variants.map((v) => [normalizeSku(v.sku), v]));
  const webCodes = new Set(variants.flatMap((v) => parseSku(v.sku)?.code ?? []));

  const updates: StockUpdate[] = [];
  let unchanged = 0;
  const groups = new Map<string, NewGroup>();
  const knownCodeSkus: string[] = [];
  const unparsable: string[] = [];

  for (const row of fileRows) {
    const variant = bySku.get(row.sku);
    if (variant) {
      const u = unsent.get(variant.id) ?? NOTHING_UNSENT;
      const target = targetStock(row.available, u);
      if (target === variant.stock) unchanged++;
      else updates.push({ variantId: variant.id, sku: variant.sku, current: variant.stock, available: row.available, unsent: u, target });
      continue;
    }
    const parsed = parseSku(row.sku);
    if (!parsed) unparsable.push(row.sku);
    // v1: new variants for an existing product are added in the product editor.
    else if (webCodes.has(parsed.code)) knownCodeSkus.push(row.sku);
    else {
      const group = groups.get(parsed.code) ?? { code: parsed.code, title: row.title, rows: [] };
      group.rows.push({ ...row, ...parsed });
      groups.set(parsed.code, group);
    }
  }

  const inFile = new Set(fileRows.map((r) => r.sku));
  const missingFromFile = variants.map((v) => v.sku).filter((sku) => !inFile.has(normalizeSku(sku)));
  return { updates, unchanged, newGroups: [...groups.values()], knownCodeSkus, unparsable, missingFromFile };
}
