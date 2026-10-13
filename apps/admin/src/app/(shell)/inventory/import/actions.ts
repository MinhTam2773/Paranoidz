"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import readXlsxFile from "read-excel-file/node";
import { createAdminClient } from "@paranoidz/db/admin";
import { createClient } from "@paranoidz/db/server";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { parseMoney } from "@/lib/product";
import { fileTimestamp, parseInventorySheet, type InventoryRow } from "@/lib/bigseller/inventory-file";
import { DEFAULT_PERCENT, parseListingsSheet, shopeePrices, suggestPrice, type ShopeePrice } from "@/lib/bigseller/listings-file";
import { colorLabels, defaultName, planImport, productSlug, type StockUpdate, type Unsent } from "@/lib/bigseller/sync";
import type { Cell } from "@/lib/bigseller/sheet";

// BigSeller → website (spec: docs/superpowers/specs/2026-10-12-bigseller-inventory-sync-design.md).
// Stateless: preview and apply both re-read the uploaded files; apply re-reads stock and
// "unsent" from the DB, so the numbers it writes are never older than the click.

const MAX_FILE_BYTES = 1024 * 1024; // Next's default server action body limit is 1 MB
const BUCKET = "product-images";
const PHOTO_ORIGIN = "https://res.bigseller.pro";
const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export type NewVariantView = { sku: string; color: string; size: string; available: number; shopeePrice: number | null; price: number | null };
export type NewGroupView = { code: string; title: string; name: string; colors: { color: string; label: string }[]; variants: NewVariantView[]; photos: number };
export type ImportPreview = {
  errors: string[];
  warnings: string[];
  freshness: { fileTime: string | null; lastSent: string | null; needsConfirm: boolean };
  updates: StockUpdate[];
  unchanged: number;
  newGroups: NewGroupView[];
  knownCodeSkus: string[];
  unparsable: string[];
  missingFromFile: string[];
};
export type GroupChoice = { code: string; name: string; colors: Record<string, string>; prices: Record<string, { price: string; original: string }> };
export type ApplyChoices = { percent: number; confirmFresh: boolean; photos: boolean; groups: GroupChoice[] };
export type ApplyResult = {
  errors: string[];
  created: { id: string; name: string; variants: number; photos: number; photoFailures: number }[];
  updated: number;
};

async function sheetOf(file: File, preferred: string): Promise<Cell[][]> {
  const sheets = await readXlsxFile(Buffer.from(await file.arrayBuffer()));
  return (sheets.find((s) => s.sheet === preferred) ?? sheets[0])?.data ?? [];
}

function fileOf(form: FormData, key: string) {
  const f = form.get(key);
  return f instanceof File && f.size > 0 ? f : null;
}

async function lastSentAt() {
  const admin = createAdminClient();
  const latest = await Promise.all([
    admin.from("orders").select("t:bigseller_exported_at").not("bigseller_exported_at", "is", null).order("bigseller_exported_at", { ascending: false }).limit(1),
    admin.from("orders").select("t:bigseller_restocked_at").not("bigseller_restocked_at", "is", null).order("bigseller_restocked_at", { ascending: false }).limit(1),
    admin.from("stock_adjustments").select("t:exported_at").not("exported_at", "is", null).order("exported_at", { ascending: false }).limit(1),
  ]);
  const times = latest.flatMap((r) => r.data ?? []).map((r) => r.t).filter((t): t is string => !!t).sort();
  return times.at(-1) ?? null;
}

type Loaded = {
  errors: string[];
  warnings: string[];
  rows: InventoryRow[];
  prices: Map<string, ShopeePrice>;
  fileTime: Date | null;
  lastSent: string | null;
};

// Read + validate both files; nothing is written.
async function load(form: FormData): Promise<Loaded> {
  const empty: Loaded = { errors: [], warnings: [], rows: [], prices: new Map(), fileTime: null, lastSent: null };
  const inventory = fileOf(form, "inventory");
  const listings = fileOf(form, "listings");
  if (!inventory) return { ...empty, errors: ["Chọn file tồn kho xuất từ BigSeller (Inventory_List….xlsx)."] };
  if (inventory.size > MAX_FILE_BYTES || (listings && listings.size > MAX_FILE_BYTES)) return { ...empty, errors: ["File tối đa 1 MB."] };

  let inv, lst;
  try {
    inv = parseInventorySheet(await sheetOf(inventory, "Single SKU"));
    lst = listings ? parseListingsSheet(await sheetOf(listings, "sheet1")) : null;
  } catch {
    return { ...empty, errors: ["Không đọc được file. Hãy dùng đúng file .xlsx xuất từ BigSeller."] };
  }
  const warnings = [...(lst?.errors ?? [])];
  if (inv.skipped.length) warnings.push(`Bỏ qua ${inv.skipped.length} SKU combo (chỉ nhập SKU đơn): ${inv.skipped.join(", ")}.`);
  if (!listings) warnings.push("Không có file sản phẩm Shopee: sản phẩm mới sẽ không có giá gợi ý.");
  return { errors: inv.errors, warnings, rows: inv.rows, prices: lst ? shopeePrices(lst.rows) : new Map(), fileTime: fileTimestamp(inventory.name), lastSent: await lastSentAt() };
}

// A file generated before the last batch went to BigSeller doesn't include it → stock too high.
function freshnessError(l: Loaded, confirmFresh: boolean) {
  if (l.fileTime && l.lastSent && l.fileTime.getTime() < new Date(l.lastSent).getTime()) {
    return `File tồn kho được xuất lúc ${formatDateTime(l.fileTime.toISOString())}, trước lần gửi BigSeller gần nhất (${formatDateTime(l.lastSent)}). Hãy xuất lại file từ BigSeller rồi nhập lại.`;
  }
  if (!l.fileTime && l.lastSent && !confirmFresh) {
    return "Không đọc được thời điểm xuất từ tên file (file đã bị đổi tên?). Xác nhận file được xuất từ BigSeller sau lần gửi gần nhất.";
  }
  return null;
}

async function webState() {
  const admin = createAdminClient();
  const [{ data: variants, error }, { data: unsent, error: uErr }] = await Promise.all([
    admin.from("product_variants").select("id, sku, stock").not("sku", "is", null),
    admin.rpc("bigseller_unsent"),
  ]);
  if (error || uErr) throw error ?? uErr;
  return {
    variants: variants.map((v) => ({ id: v.id, sku: v.sku!, stock: v.stock })),
    unsent: new Map<string, Unsent>(unsent.map((u) => [u.variant_id, { out: u.unsent_out, back: u.unsent_back, adj: u.unsent_adj }])),
  };
}

export async function previewImport(form: FormData): Promise<ImportPreview> {
  await requireAdmin();
  const l = await load(form);
  const percent = Number(form.get("percent")) || DEFAULT_PERCENT;
  const freshness = {
    fileTime: l.fileTime?.toISOString() ?? null,
    lastSent: l.lastSent,
    needsConfirm: !l.fileTime && !!l.lastSent,
  };
  const base = { errors: l.errors, warnings: l.warnings, freshness, updates: [], unchanged: 0, newGroups: [], knownCodeSkus: [], unparsable: [], missingFromFile: [] };
  const stale = freshnessError(l, true); // the confirm tick is shown on the preview
  if (stale) base.errors = [...base.errors, stale];
  if (base.errors.length) return base;

  const { variants, unsent } = await webState();
  const plan = planImport(l.rows, variants, unsent);
  const newGroups = plan.newGroups.map((g) => {
    const labels = colorLabels(g, (sku) => l.prices.get(sku)?.colorLabel);
    return {
      code: g.code,
      title: g.title,
      name: defaultName(g, plan.newGroups),
      colors: [...labels].map(([color, label]) => ({ color, label })),
      photos: new Set(g.rows.filter((r) => r.imageUrl).map((r) => r.color)).size,
      variants: g.rows.map((r) => {
        const shopee = l.prices.get(r.sku)?.price ?? null;
        return { sku: r.sku, color: r.color, size: r.size, available: r.available, shopeePrice: shopee, price: shopee ? suggestPrice(shopee, percent) : null };
      }),
    };
  });
  return { ...base, ...plan, newGroups };
}

export async function applyImport(form: FormData): Promise<ApplyResult> {
  await requireAdmin();
  const result: ApplyResult = { errors: [], created: [], updated: 0 };
  let choices: ApplyChoices;
  try {
    choices = JSON.parse(String(form.get("choices")));
  } catch {
    return { ...result, errors: ["Dữ liệu không hợp lệ. Tải lại trang."] };
  }

  const l = await load(form);
  const stale = freshnessError(l, choices.confirmFresh === true);
  if (l.errors.length || stale) return { ...result, errors: [...l.errors, ...(stale ? [stale] : [])] };

  const admin = createAdminClient();
  let { variants, unsent } = await webState();
  const plan = planImport(l.rows, variants, unsent);

  // ---------- validate every new product before the first write ----------
  const groups = new Map(plan.newGroups.map((g) => [g.code, g]));
  const picked = (choices.groups ?? []).filter((c) => groups.has(c.code));
  const drafts = [];
  const slugs = new Set<string>();
  for (const c of picked) {
    const g = groups.get(c.code)!;
    const name = String(c.name ?? "").trim();
    const slug = productSlug(name, c.code);
    const where = `Sản phẩm ${c.code}`;
    if (!name || name.length > 120) { result.errors.push(`${where}: nhập tên (tối đa 120 ký tự).`); continue; }
    if (slugs.has(slug)) { result.errors.push(`${where}: đường dẫn "${slug}" trùng với một sản phẩm mới khác. Đổi tên.`); continue; }
    slugs.add(slug);
    const labels = new Map(g.rows.map((r) => [r.color, String(c.colors?.[r.color] ?? r.color).trim()]));
    if ([...labels.values()].some((x) => !x || x.length > 40)) { result.errors.push(`${where}: tên màu 1–40 ký tự.`); continue; }
    if (new Set([...labels.values()].map((x) => x.toLowerCase())).size !== labels.size) { result.errors.push(`${where}: hai màu trùng tên.`); continue; }
    const rows = [];
    for (const r of g.rows) {
      const price = parseMoney(String(c.prices?.[r.sku]?.price ?? ""));
      const original = parseMoney(String(c.prices?.[r.sku]?.original ?? ""));
      if (!price || Number.isNaN(price) || price > 1_000_000_000) { result.errors.push(`${where}, ${r.sku}: nhập giá bán lớn hơn 0.`); continue; }
      if (Number.isNaN(original) || (original !== null && original <= price)) { result.errors.push(`${where}, ${r.sku}: giá gốc phải lớn hơn giá bán (hoặc để trống).`); continue; }
      rows.push({ ...r, label: labels.get(r.color)!, price, original });
    }
    drafts.push({ code: c.code, name, slug, rows });
  }
  if (drafts.length) {
    const { data: taken } = await admin.from("products").select("slug").in("slug", drafts.map((d) => d.slug));
    for (const t of taken ?? []) result.errors.push(`Đường dẫn "${t.slug}" đã có sản phẩm khác dùng. Đổi tên sản phẩm mới.`);
  }
  if (result.errors.length) return result;

  // ---------- create (hidden; the client finishes them in the editor) ----------
  for (const d of drafts) {
    const { data: product, error } = await admin.from("products").insert({ name: d.name, slug: d.slug, is_active: false }).select("id").single();
    if (error) { result.errors.push(`Không tạo được "${d.name}". Vui lòng thử lại.`); continue; }
    // A brand-new variant may start with its stock (CLAUDE.md §4); nothing is unsent for it.
    const { error: vErr } = await admin.from("product_variants").insert(
      d.rows.map((r) => ({ product_id: product.id, color: r.label, size: r.size, sku: r.sku, stock: r.available, price: r.price, original_price: r.original })),
    );
    if (vErr) {
      await admin.from("products").delete().eq("id", product.id);
      result.errors.push(`Không tạo được biến thể cho "${d.name}". Vui lòng thử lại.`);
      continue;
    }
    let photos = 0;
    let photoFailures = 0;
    if (choices.photos) {
      const byColor = new Map<string, string>();
      for (const r of d.rows) if (r.imageUrl && !byColor.has(r.label)) byColor.set(r.label, r.imageUrl);
      const paths = await Promise.all([...byColor].map(async ([label, url]) => ({ label, path: await importPhoto(url, d.slug) })));
      const ok = paths.filter((p): p is { label: string; path: string } => !!p.path);
      photoFailures = paths.length - ok.length;
      if (ok.length) {
        const { error: iErr } = await admin.from("product_images").insert(
          ok.map((p, i) => ({ product_id: product.id, storage_path: p.path, color: p.label, sort_order: i, is_primary: i === 0 })),
        );
        if (iErr) {
          await admin.storage.from(BUCKET).remove(ok.map((p) => p.path));
          photoFailures = paths.length;
        } else photos = ok.length;
      }
    }
    result.created.push({ id: product.id, name: d.name, variants: d.rows.length, photos, photoFailures });
  }

  // ---------- stock: fresh read, one compare-and-set for all ----------
  ({ variants, unsent } = await webState());
  const { updates } = planImport(l.rows, variants, unsent);
  if (updates.length) {
    const supabase = await createClient(); // as the admin, like the product editor
    const { error } = await supabase.rpc("set_variant_stocks", {
      p_changes: updates.map((u) => ({ variant_id: u.variantId, expected: u.current, stock: u.target })),
    });
    if (error) {
      result.errors.push(error.message === "STOCK_CHANGED"
        ? "Tồn kho vừa thay đổi (có đơn hàng mới) nên chưa cập nhật. Bấm Áp dụng lại."
        : "Không thể cập nhật tồn kho. Vui lòng thử lại.");
    } else result.updated = updates.length;
  }
  revalidatePath("/", "layout");
  return result;
}

// Only BigSeller's image host; type and size checked before anything is stored.
async function importPhoto(url: string, slug: string): Promise<string | null> {
  try {
    const u = new URL(url);
    if (u.origin !== PHOTO_ORIGIN) return null;
    u.search = "";
    const res = await fetch(u, { redirect: "error", signal: AbortSignal.timeout(15_000) });
    const type = res.headers.get("content-type")?.split(";")[0].trim() ?? "";
    const ext = PHOTO_TYPES[type];
    if (!res.ok || !ext || Number(res.headers.get("content-length") ?? 0) > MAX_PHOTO_BYTES) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_PHOTO_BYTES) return null;
    const path = `products/${slug}/${randomUUID()}.${ext}`;
    const { error } = await createAdminClient().storage.from(BUCKET).upload(path, bytes, { contentType: type });
    return error ? null : path;
  } catch {
    return null;
  }
}
