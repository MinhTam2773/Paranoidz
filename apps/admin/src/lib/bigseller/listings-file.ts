// BigSeller Products → Shopee → Active → Import & Export → Export by Page (standard template).
// Used only to suggest prices and colour names for products the import creates.
import { normalizeSku } from "./sku.ts";
import { columns, missingColumns, text, type Cell } from "./sheet.ts";

const FILE = "File sản phẩm Shopee";
const REQUIRED = ["Store Nickname", "SKU", "Variation", "Price", "Special Price"] as const;

// Client, 2026-10-12: website price = 70 % of the promotion price in this shop.
export const PRICING_SHOP = "pdz01-SP";
export const DEFAULT_PERCENT = 70;

export type ListingRow = { shop: string; sku: string; variation: string; price: number; specialPrice: number };

export function parseListingsSheet(data: Cell[][]): { rows: ListingRow[]; errors: string[] } {
  const { index, missing } = columns(data[0], REQUIRED);
  if (!data.length) return { rows: [], errors: [`${FILE} trống.`] };
  if (missing.length) return { rows: [], errors: [missingColumns(FILE, missing)] };

  const rows: ListingRow[] = [];
  const errors: string[] = [];
  const money = (c: Cell) => (text(c) === "" ? 0 : Number(text(c)));
  data.slice(1).forEach((r, i) => {
    const sku = normalizeSku(text(r[index.SKU]));
    if (!sku) return;
    const price = money(r[index.Price]);
    const specialPrice = money(r[index["Special Price"]]);
    if (!(price >= 0) || !(specialPrice >= 0)) return void errors.push(`${FILE}, dòng ${i + 2} (${sku}): giá không hợp lệ.`);
    rows.push({ shop: text(r[index["Store Nickname"]]), sku, variation: text(r[index.Variation]), price, specialPrice });
  });
  return { rows, errors };
}

export type ShopeePrice = { price: number; colorLabel: string | null };

// Per SKU in `shop`: the promotion price (list price when there is none); when the
// shop lists the SKU twice, the lower one. Colour label = Shopee's variation before the comma.
export function shopeePrices(rows: ListingRow[], shop = PRICING_SHOP) {
  const out = new Map<string, ShopeePrice>();
  for (const r of rows) {
    if (r.shop !== shop) continue;
    const price = r.specialPrice > 0 ? r.specialPrice : r.price;
    if (!(price > 0)) continue;
    const prev = out.get(r.sku);
    if (prev && prev.price <= price) continue;
    out.set(r.sku, { price, colorLabel: r.variation.split(",")[0].trim() || null });
  }
  return out;
}

// Never above the percentage: 199.000 × 70 % = 139.300 → 139.000.
export function suggestPrice(shopeePrice: number, percent: number) {
  return Math.floor((shopeePrice * percent) / 100 / 1000) * 1000;
}
