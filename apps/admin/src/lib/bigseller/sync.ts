// BigSeller → website: which stock to set and which products to create.
// Spec "The sync rule": stock = max(0, available − unsent_out + unsent_back + unsent_adj).
import { normalizeSku, parseSku, type ParsedSku } from "./sku.ts";
import type { InventoryRow } from "./inventory-file.ts";

export type Unsent = { out: number; back: number; adj: number };
export const NOTHING_UNSENT: Unsent = { out: 0, back: 0, adj: 0 };

export function targetStock(available: number, unsent: Unsent = NOTHING_UNSENT) {
  return Math.max(0, available - unsent.out + unsent.back + unsent.adj);
}

export type WebVariant = { id: string; sku: string; stock: number };
export type StockUpdate = { variantId: string; sku: string; current: number; available: number; unsent: Unsent; target: number };
export type NewGroup = { code: string; title: string; rows: (InventoryRow & ParsedSku)[] };

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
