"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@paranoidz/db/admin";
import { createClient } from "@paranoidz/db/server";
import { requireAdmin } from "@/lib/auth";
import { validateProduct, type FieldErrors, type ProductInput } from "@/lib/product";

export type SaveResult = { errors?: FieldErrors; id?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Create or update a product and its variants. Writes use the service role after
// requireAdmin(); stock on existing variants changes only through
// set_variant_stocks() (compare-and-set), called as the admin. Not one
// transaction: everything that can fail is checked before the first write.
export async function saveProduct(input: ProductInput): Promise<SaveResult> {
  await requireAdmin();
  const { errors, product, variants } = validateProduct(input);
  if (Object.keys(errors).length) return { errors };

  const admin = createAdminClient();
  if (product.category_id) {
    const { data } = await admin.from("categories").select("id").eq("id", product.category_id).maybeSingle();
    if (!UUID.test(product.category_id) || !data) return { errors: { categoryId: "Danh mục không tồn tại." } };
  }

  // SKUs are unique across the catalog.
  const skus = variants.flatMap((v) => (v.sku ? [v.sku] : []));
  if (skus.length) {
    const { data: taken } = await admin.from("product_variants").select("sku, product_id").in("sku", skus);
    const clash = new Set((taken ?? []).filter((t) => t.product_id !== input.id).map((t) => t.sku));
    input.variants.forEach((v, i) => {
      if (!v.removed && clash.has(v.sku.normalize("NFC").trim())) errors[`variants.${i}.sku`] = "SKU đã được dùng cho sản phẩm khác.";
    });
    if (Object.keys(errors).length) return { errors };
  }

  // ---------- create ----------
  if (!input.id) {
    const { data: created, error } = await admin.from("products").insert(product).select("id").single();
    if (error) return { errors: error.code === "23505" ? { slug: "Slug đã được dùng cho sản phẩm khác." } : { form: "Không thể lưu. Vui lòng thử lại." } };
    // A brand-new variant may start with its stock (CLAUDE.md §4).
    const { error: vErr } = await admin.from("product_variants").insert(
      variants.map((v) => ({ product_id: created.id, color: v.color, size: v.size, price: v.price, original_price: v.original_price, stock: v.stock, sku: v.sku })),
    );
    if (vErr) {
      await admin.from("products").delete().eq("id", created.id);
      return { errors: { form: "Không thể lưu biến thể. Vui lòng thử lại." } };
    }
    revalidatePath("/", "layout");
    return { id: created.id };
  }

  // ---------- update ----------
  const { data: existing, error: loadErr } = await admin
    .from("product_variants").select("id, color, size").eq("product_id", input.id);
  if (loadErr || !existing) return { errors: { form: "Không tìm thấy sản phẩm." } };
  const existingIds = new Set(existing.map((v) => v.id));
  if (variants.some((v) => v.id && !existingIds.has(v.id))) return { errors: { form: "Dữ liệu biến thể không hợp lệ. Tải lại trang." } };

  // Removing a variant that has been ordered would orphan order history and skip
  // its stock restore on a later cancel: set its stock to 0 instead.
  const keptIds = new Set(variants.flatMap((v) => (v.id ? [v.id] : [])));
  const removed = existing.filter((v) => !keptIds.has(v.id));
  if (removed.length) {
    const { data: ordered } = await admin.from("order_items").select("variant_id").in("variant_id", removed.map((v) => v.id));
    const orderedIds = new Set((ordered ?? []).map((o) => o.variant_id));
    const blocked = removed.filter((v) => orderedIds.has(v.id));
    if (blocked.length) {
      return { errors: { variants: `Không thể xóa ${blocked.map((v) => `${v.color} / ${v.size}`).join(", ")}: đã có đơn hàng. Đặt tồn kho = 0 để ngừng bán.` } };
    }
  }

  // Everything but the slug, which is fixed after creation (URLs, image paths).
  const { name, category_id, description, care_instructions, size_guide, is_active, shopee_sold_count, gift_label, video_url, video_poster_url } = product;
  const { error: pErr } = await admin
    .from("products").update({ name, category_id, description, care_instructions, size_guide, is_active, shopee_sold_count, gift_label, video_url, video_poster_url }).eq("id", input.id);
  if (pErr) return { errors: { form: "Không thể lưu. Vui lòng thử lại." } };

  if (removed.length) await admin.from("product_variants").delete().in("id", removed.map((v) => v.id));
  for (const v of variants.filter((v) => v.id)) {
    await admin.from("product_variants").update({ price: v.price, original_price: v.original_price, sku: v.sku }).eq("id", v.id!);
  }
  const added = variants.filter((v) => !v.id);
  if (added.length) {
    const { error } = await admin.from("product_variants").insert(
      added.map((v) => ({ product_id: input.id!, color: v.color, size: v.size, price: v.price, original_price: v.original_price, stock: v.stock, sku: v.sku })),
    );
    if (error) {
      revalidatePath("/", "layout");
      return { errors: { form: "Đã lưu thông tin, nhưng không thể thêm biến thể mới. Vui lòng thử lại." } };
    }
  }

  const stockChanges = variants
    .filter((v) => v.id && v.expectedStock !== undefined && v.stock !== v.expectedStock)
    .map((v) => ({ variant_id: v.id!, expected: v.expectedStock!, stock: v.stock }));
  revalidatePath("/", "layout");
  if (stockChanges.length) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_variant_stocks", { p_changes: stockChanges });
    if (error) {
      return {
        errors: {
          form: error.message === "STOCK_CHANGED"
            ? "Đã lưu thông tin, nhưng tồn kho chưa được cập nhật: vừa có đơn hàng thay đổi tồn kho. Số mới đã được tải lại — kiểm tra và lưu lại."
            : "Đã lưu thông tin, nhưng không thể cập nhật tồn kho. Vui lòng thử lại.",
        },
      };
    }
  }
  return { id: input.id };
}

const COLOR_ERRORS: Record<string, string> = {
  COLOR_EXISTS: "Sản phẩm đã có màu này.",
  COLOR_NOT_FOUND: "Màu này không còn trên sản phẩm. Tải lại trang.",
  INVALID_COLOR: "Nhập tên màu (tối đa 40 ký tự).",
};

// Renames one colour on every size and on its photos (rename_product_color, one
// transaction). Order history keeps the old name in its snapshots.
export async function renameColor(productId: string, from: string, to: string): Promise<{ error?: string }> {
  await requireAdmin();
  if (!UUID.test(productId)) return { error: "Không tìm thấy sản phẩm." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("rename_product_color", { p_product_id: productId, p_from: from, p_to: to.trim() });
  if (error) return { error: COLOR_ERRORS[error.message] ?? "Không thể đổi tên màu. Vui lòng thử lại." };
  revalidatePath("/", "layout");
  return {};
}

// The swatch colour for one colour, on every size of it (storefront card dots). null = no swatch.
export async function setColorHex(productId: string, color: string, hex: string | null): Promise<{ error?: string }> {
  await requireAdmin();
  if (!UUID.test(productId)) return { error: "Không tìm thấy sản phẩm." };
  if (hex !== null && !/^#[0-9a-f]{6}$/.test(hex)) return { error: "Mã màu không hợp lệ." };
  const { data, error } = await createAdminClient()
    .from("product_variants").update({ color_hex: hex }).eq("product_id", productId).eq("color", color).select("id");
  if (error) return { error: "Không thể lưu màu. Vui lòng thử lại." };
  if (!data.length) return { error: COLOR_ERRORS.COLOR_NOT_FOUND };
  revalidatePath("/", "layout");
  return {};
}

export async function setProductActive(id: string, isActive: boolean): Promise<{ error?: string }> {
  await requireAdmin();
  const { error } = await createAdminClient().from("products").update({ is_active: isActive }).eq("id", id);
  if (error) return { error: "Không thể cập nhật. Vui lòng thử lại." };
  revalidatePath("/", "layout");
  return {};
}
