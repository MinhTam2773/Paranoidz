import type { Json } from "@paranoidz/db/types";

// Shared by the product form (client) and saveProduct (server, which re-validates
// everything — the client checks are only for quick feedback).

export type VariantInput = {
  id?: string; // existing variant; absent = new row
  color: string;
  size: string;
  price: string;
  originalPrice: string;
  stock: string;
  expectedStock?: number; // stock when the form loaded (set_variant_stocks compare-and-set)
  sku: string;
  removed?: boolean;
};

export type ProductInput = {
  id?: string; // absent = create
  name: string;
  slug: string;
  categoryId: string;
  description: string;
  careInstructions: string;
  sizeGuide: string;
  shopeeSoldCount: number;
  giftLabel: string;
  videoUrl: string;
  videoPosterUrl: string;
  isActive: boolean;
  variants: VariantInput[];
};

export type FieldErrors = Record<string, string>;

export type SizeGuide = { sizes: string[]; rows: { label: string; values: string[] }[] };

// "Áo Thun Đen" → "ao-thun-den". Diacritics stripped, đ → d.
export function slugify(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
}

// Size guide as text, one line per row (ARCHITECTURE.md §7 jsonb shape):
//   Size: S, M, L
//   Ngực (cm): 52, 55, 58
// First line = sizes ("Size:" optional), then "Label: one value per size".
export function sizeGuideToText(value: Json | null) {
  const g = value as SizeGuide | null;
  if (!g?.sizes?.length) return "";
  return [`Size: ${g.sizes.join(", ")}`, ...g.rows.map((r) => `${r.label}: ${r.values.join(", ")}`)].join("\n");
}

export function parseSizeGuide(text: string): { value: SizeGuide | null; error?: string } {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { value: null };
  const split = (s: string) => s.split(",").map((v) => v.trim());
  const sizes = split(lines[0].replace(/^size\s*:/i, ""));
  if (sizes.some((s) => !s)) return { value: null, error: "Dòng đầu: các size cách nhau bằng dấu phẩy, ví dụ \"Size: S, M, L\"." };
  const rows = [];
  for (const [i, line] of lines.slice(1).entries()) {
    const colon = line.indexOf(":");
    const label = colon > 0 ? line.slice(0, colon).trim() : "";
    const values = colon > 0 ? split(line.slice(colon + 1)) : [];
    if (!label || values.length !== sizes.length || values.some((v) => !v)) {
      return { value: null, error: `Dòng ${i + 2}: cần "Tên: " và đúng ${sizes.length} giá trị (mỗi size một giá trị).` };
    }
    rows.push({ label, values });
  }
  if (!rows.length) return { value: null, error: "Thêm ít nhất một dòng số đo dưới dòng size." };
  return { value: { sizes, rows } };
}

// "269.000", "269 000", "269,000" → 269000. Empty → null; anything else → NaN.
export function parseMoney(raw: string) {
  const s = raw.replace(/[.\s,₫]/g, "");
  if (!s) return null;
  return /^\d{1,10}$/.test(s) ? Number(s) : NaN;
}

export type CleanVariant = {
  id?: string;
  color: string;
  size: string;
  price: number;
  original_price: number | null;
  stock: number;
  expectedStock?: number;
  sku: string | null;
};

export function validateProduct(input: ProductInput) {
  const errors: FieldErrors = {};
  const name = input.name.trim();
  if (!name) errors.name = "Nhập tên sản phẩm.";
  else if (name.length > 120) errors.name = "Tên tối đa 120 ký tự.";

  const slug = input.slug.trim();
  if (!input.id && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) errors.slug = "Chỉ dùng chữ thường không dấu, số và dấu gạch ngang.";
  else if (slug.length > 80) errors.slug = "Slug tối đa 80 ký tự.";

  const description = input.description.trim();
  if (description.length > 20000) errors.description = "Mô tả tối đa 20000 ký tự (kể cả thẻ ảnh).";
  const careInstructions = input.careInstructions.trim();
  if (careInstructions.length > 1000) errors.careInstructions = "Tối đa 1000 ký tự.";

  const guide = parseSizeGuide(input.sizeGuide);
  if (guide.error) errors.sizeGuide = guide.error;

  const variants: CleanVariant[] = [];
  const seen = new Set<string>();
  const skus = new Set<string>();
  input.variants.forEach((v, i) => {
    if (v.removed) return;
    const key = (f: string) => `variants.${i}.${f}`;
    const color = v.color.trim();
    const size = v.size.trim();
    if (!color || color.length > 40) errors[key("color")] = "Nhập màu (tối đa 40 ký tự).";
    if (!size || size.length > 20) errors[key("size")] = "Nhập size (tối đa 20 ký tự).";
    const combo = `${color.toLowerCase()}|${size.toLowerCase()}`;
    if (color && size && seen.has(combo)) errors[key("size")] = "Trùng màu + size với một dòng khác.";
    seen.add(combo);

    const price = parseMoney(v.price);
    if (!price || Number.isNaN(price) || price > 1_000_000_000) errors[key("price")] = "Nhập giá (số, lớn hơn 0).";
    const original = parseMoney(v.originalPrice);
    if (Number.isNaN(original) || (original !== null && price && original <= price)) {
      errors[key("originalPrice")] = "Giá gốc phải lớn hơn giá bán (để trống nếu không giảm giá).";
    }
    const stock = /^\d{1,5}$/.test(v.stock.trim()) ? Number(v.stock.trim()) : NaN;
    if (Number.isNaN(stock)) errors[key("stock")] = "Nhập số từ 0 đến 99999.";
    // NFC: BigSeller's SKUs ("QT03-Xám") must match byte for byte (DB check product_variants_sku_nfc).
    const sku = v.sku.normalize("NFC").trim();
    if (sku.length > 50) errors[key("sku")] = "SKU tối đa 50 ký tự.";
    else if (sku && skus.has(sku.toUpperCase())) errors[key("sku")] = "SKU trùng với một dòng khác.";
    if (sku) skus.add(sku.toUpperCase());

    variants.push({
      id: v.id, color, size, price: price || 0, original_price: original || null, stock,
      expectedStock: v.expectedStock, sku: sku || null,
    });
  });
  if (!variants.length) errors.variants = "Thêm ít nhất một biến thể (màu + size).";

  return {
    errors,
    product: {
      name, slug, description: description || null, care_instructions: careInstructions || null,
      size_guide: guide.value as Json | null, is_active: input.isActive,
      category_id: input.categoryId || null,
      shopee_sold_count: Math.max(0, Math.floor(input.shopeeSoldCount || 0)),
      gift_label: input.giftLabel.trim() || null,
      video_url: input.videoUrl.trim() || null,
      video_poster_url: input.videoPosterUrl.trim() || null,
    },
    variants,
  };
}
