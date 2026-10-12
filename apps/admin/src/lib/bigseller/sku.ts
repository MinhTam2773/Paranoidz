// BigSeller SKUs are `code-Colour-Size` (pdz08-Gray-XL); socks have no size (QT03-Xám).
// Kept free of app imports so `node --test` can load it directly.

export const FREESIZE = "Freesize";

const SIZES = new Set(["XS", "S", "M", "L", "XL", "XXL", "XXXL", "2XL", "3XL", "4XL", "FREE", "FREESIZE"]);

// One Unicode form everywhere (the DB enforces NFC: product_variants_sku_nfc).
export function normalizeSku(sku: string) {
  return sku.normalize("NFC").trim();
}

export type ParsedSku = { code: string; color: string; size: string };

// Code = text before the first "-". Size = the last part when it is a size token,
// otherwise Freesize and the colour is everything after the code.
export function parseSku(sku: string): ParsedSku | null {
  const parts = normalizeSku(sku).split("-");
  if (parts.length < 2 || parts.some((p) => !p.trim())) return null;
  const [code, ...rest] = parts;
  const last = rest[rest.length - 1];
  if (rest.length >= 2 && SIZES.has(last.toUpperCase())) {
    return { code, color: rest.slice(0, -1).join("-"), size: last };
  }
  return { code, color: rest.join("-"), size: FREESIZE };
}
