"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@paranoidz/db/admin";
import { requireAdmin } from "@/lib/auth";

// Bundles (DASHBOARD_DESIGN.md §6.5). place_order() prices them (ARCHITECTURE.md §5):
// flat ₫ off per complete set, better of bundle vs voucher. Orders snapshot what was
// applied (orders.applied_bundles), so every field stays editable after use.

export type BundleInput = { id?: string; name: string; discountAmount: string; isActive: boolean; productIds: string[] };
export type BundleResult = { errors?: Record<string, string>; id?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FAILED = { errors: { form: "Không thể lưu. Vui lòng thử lại." } };

const done = () => revalidatePath("/bundles", "layout");

export async function saveBundle(input: BundleInput): Promise<BundleResult> {
  await requireAdmin();
  const errors: Record<string, string> = {};
  const name = input.name.trim();
  if (!name || name.length > 80) errors.name = "Nhập tên (tối đa 80 ký tự).";
  const discount = /^\d+$/.test(input.discountAmount.trim()) ? Number(input.discountAmount.trim()) : NaN;
  if (!(discount >= 1000 && discount <= 100_000_000)) errors.discountAmount = "Nhập số tiền từ ₫1.000 đến ₫100.000.000.";
  const productIds = [...new Set(input.productIds)];
  if (!productIds.every((id) => UUID.test(id))) errors.products = "Danh sách sản phẩm không hợp lệ.";
  else if (productIds.length < 2 || productIds.length > 10) errors.products = "Chọn từ 2 đến 10 sản phẩm.";
  if (Object.keys(errors).length) return { errors };

  const admin = createAdminClient();
  const { data: products } = await admin.from("products").select("id, product_variants(price)").in("id", productIds);
  if (products?.length !== productIds.length) return { errors: { products: "Có sản phẩm không còn tồn tại. Tải lại trang." } };
  if (products.some((p) => !p.product_variants.length)) return { errors: { products: "Có sản phẩm chưa có phân loại (giá)." } };
  // The cheapest possible set must still cost something: every set is at least this much.
  const combined = products.reduce((sum, p) => sum + Math.min(...p.product_variants.map((v) => v.price)), 0);
  if (discount >= combined) return { errors: { discountAmount: "Mức giảm phải nhỏ hơn tổng giá lẻ thấp nhất của combo." } };

  const fields = { name, discount_amount: discount, is_active: input.isActive };
  if (!input.id) {
    const { data, error } = await admin.from("bundles").insert(fields).select("id").single();
    if (error) return FAILED;
    const { error: itemsErr } = await admin.from("bundle_items").insert(productIds.map((product_id) => ({ bundle_id: data.id, product_id })));
    if (itemsErr) {
      await admin.from("bundles").delete().eq("id", data.id); // don't leave a half-created one
      return FAILED;
    }
    done();
    return { id: data.id };
  }

  // Diff the items, adding before removing: an order placed mid-save then sees a bundle
  // that needs more products (stricter), never one that needs fewer.
  const { data: current, error: curErr } = await admin.from("bundle_items").select("product_id").eq("bundle_id", input.id);
  if (curErr) return FAILED;
  const had = new Set(current.map((i) => i.product_id));
  const added = productIds.filter((id) => !had.has(id));
  const removed = [...had].filter((id) => !productIds.includes(id));
  if (added.length) {
    const { error } = await admin.from("bundle_items").insert(added.map((product_id) => ({ bundle_id: input.id!, product_id })));
    if (error) return FAILED;
  }
  if (removed.length) {
    const { error } = await admin.from("bundle_items").delete().eq("bundle_id", input.id).in("product_id", removed);
    if (error) return FAILED;
  }
  const { data, error } = await admin.from("bundles").update(fields).eq("id", input.id).select("id");
  if (error || !data.length) return FAILED;
  done();
  return { id: input.id };
}

export async function setBundleActive(id: string, isActive: boolean): Promise<{ error?: string }> {
  await requireAdmin();
  const { data, error } = await createAdminClient().from("bundles").update({ is_active: isActive }).eq("id", id).select("id");
  if (error || !data.length) return { error: "Không thể cập nhật. Vui lòng thử lại." };
  done();
  return {};
}
