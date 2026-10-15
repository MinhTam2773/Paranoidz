"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@paranoidz/db/admin";
import { requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/product";

// Categories (DASHBOARD_DESIGN.md §6.3). sort_order = order of the storefront
// homepage category rows (ISR, so changes appear within 60s there).

const done = () => revalidatePath("/products", "layout");

function checkName(raw: string) {
  const name = raw.trim();
  if (!name || name.length > 50) return { error: "Nhập tên danh mục (tối đa 50 ký tự)." };
  return { name };
}

export async function addCategory(raw: string): Promise<{ error?: string }> {
  await requireAdmin();
  const { name, error } = checkName(raw);
  if (error) return { error };
  const slug = slugify(name!);
  if (!slug) return { error: "Tên cần có ít nhất một chữ cái hoặc chữ số." };
  const admin = createAdminClient();
  const { data: last } = await admin.from("categories").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { error: insertError } = await admin.from("categories").insert({ name: name!, slug, sort_order: (last?.sort_order ?? -1) + 1 });
  if (insertError) return { error: insertError.code === "23505" ? "Đã có danh mục này." : "Không thể thêm. Vui lòng thử lại." };
  done();
  return {};
}

// Name only: the slug is internal and stays as created.
export async function renameCategory(id: string, raw: string): Promise<{ error?: string }> {
  await requireAdmin();
  const { name, error } = checkName(raw);
  if (error) return { error };
  const { data, error: updateError } = await createAdminClient().from("categories").update({ name: name! }).eq("id", id).select("id");
  if (updateError || !data?.length) return { error: "Không thể lưu. Tải lại trang rồi thử lại." };
  done();
  return {};
}

export async function reorderCategories(orderedIds: string[]): Promise<{ error?: string }> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin.from("categories").select("id");
  const current = new Set((data ?? []).map((c) => c.id));
  if (orderedIds.length !== current.size || !orderedIds.every((id) => current.has(id))) return { error: "Danh sách đã thay đổi. Tải lại trang." };
  await Promise.all(orderedIds.map((id, sort_order) => admin.from("categories").update({ sort_order }).eq("id", id)));
  done();
  return {};
}

// Only unused categories: the FK would silently clear category_id on its products.
export async function deleteCategory(id: string): Promise<{ error?: string }> {
  await requireAdmin();
  const admin = createAdminClient();
  const { count, error: countError } = await admin.from("products").select("id", { count: "exact", head: true }).eq("category_id", id);
  if (countError) return { error: "Không thể xóa. Vui lòng thử lại." };
  if (count) {
    done(); // the page's count was stale
    return { error: `Danh mục đang có ${count} sản phẩm. Chuyển các sản phẩm sang danh mục khác trước.` };
  }
  const { error } = await admin.from("categories").delete().eq("id", id);
  if (error) return { error: "Không thể xóa. Vui lòng thử lại." };
  done();
  return {};
}
