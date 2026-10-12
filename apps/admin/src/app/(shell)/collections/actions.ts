"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@paranoidz/db/admin";
import { requireAdmin } from "@/lib/auth";

// Collections (DASHBOARD_DESIGN.md §6.6). The storefront shows an active
// collection at /collections/<slug> (ISR, so changes appear within 60s).

export type CollectionInput = { id?: string; name: string; slug: string; description: string; isActive: boolean; productIds: string[] };
export type CollectionResult = { errors?: Record<string, string>; id?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const done = () => revalidatePath("/collections", "layout");

export async function saveCollection(input: CollectionInput): Promise<CollectionResult> {
  await requireAdmin();
  const errors: Record<string, string> = {};
  const name = input.name.trim();
  if (!name || name.length > 80) errors.name = "Nhập tên (tối đa 80 ký tự).";
  const slug = input.slug.trim();
  if (!input.id && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) errors.slug = "Chỉ dùng chữ thường không dấu, số và dấu gạch ngang.";
  if (slug.length > 80) errors.slug = "Tối đa 80 ký tự.";
  const description = input.description.trim();
  if (description.length > 300) errors.description = "Tối đa 300 ký tự.";
  const productIds = [...new Set(input.productIds)];
  if (productIds.length > 200 || !productIds.every((id) => UUID.test(id))) errors.products = "Danh sách sản phẩm không hợp lệ.";
  if (Object.keys(errors).length) return { errors };

  const admin = createAdminClient();
  if (productIds.length) {
    const { count } = await admin.from("products").select("id", { count: "exact", head: true }).in("id", productIds);
    if (count !== productIds.length) return { errors: { products: "Có sản phẩm không còn tồn tại. Tải lại trang." } };
  }

  let id = input.id;
  if (!id) {
    const { data: last } = await admin.from("collections").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const { data, error } = await admin
      .from("collections").insert({ name, slug, description: description || null, is_active: input.isActive, sort_order: (last?.sort_order ?? -1) + 1 }).select("id").single();
    if (error) return { errors: error.code === "23505" ? { slug: "Slug đã được dùng cho bộ sưu tập khác." } : { form: "Không thể lưu. Vui lòng thử lại." } };
    id = data.id;
  } else {
    // Slug stays fixed after creation: storefront links (and the nav) use it.
    const { data, error } = await admin.from("collections").update({ name, description: description || null, is_active: input.isActive }).eq("id", id).select("id");
    if (error || !data?.length) return { errors: { form: "Không thể lưu. Vui lòng thử lại." } };
    await admin.from("collection_items").delete().eq("collection_id", id);
  }

  if (productIds.length) {
    const { error } = await admin
      .from("collection_items").insert(productIds.map((product_id, sort_order) => ({ collection_id: id, product_id, sort_order })));
    if (error) {
      if (!input.id) await admin.from("collections").delete().eq("id", id); // don't leave a half-created one
      done();
      return { errors: { form: input.id ? "Đã lưu tên, nhưng không thể lưu danh sách sản phẩm. Vui lòng thử lại." : "Không thể lưu. Vui lòng thử lại." } };
    }
  }
  done();
  return { id };
}

export async function reorderCollections(orderedIds: string[]): Promise<{ error?: string }> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin.from("collections").select("id");
  const current = new Set((data ?? []).map((c) => c.id));
  if (orderedIds.length !== current.size || !orderedIds.every((id) => current.has(id))) return { error: "Danh sách đã thay đổi. Tải lại trang." };
  await Promise.all(orderedIds.map((id, sort_order) => admin.from("collections").update({ sort_order }).eq("id", id)));
  done();
  return {};
}

export async function setCollectionActive(id: string, isActive: boolean): Promise<{ error?: string }> {
  await requireAdmin();
  const { error } = await createAdminClient().from("collections").update({ is_active: isActive }).eq("id", id);
  if (error) return { error: "Không thể cập nhật. Vui lòng thử lại." };
  done();
  return {};
}
