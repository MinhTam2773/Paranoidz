"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@paranoidz/db/server";
import { requireAdmin } from "@/lib/auth";
import { ADJUST_REASONS } from "@/lib/inventory";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ERRORS: Record<string, string> = {
  STOCK_NEGATIVE: "Tồn kho không thể nhỏ hơn 0 (có thể vừa có đơn hàng). Tải lại trang và thử lại.",
  SKU_REQUIRED: "Biến thể chưa có SKU. Thêm SKU trong trang sản phẩm trước.",
  VARIANT_NOT_FOUND: "Không tìm thấy biến thể. Tải lại trang.",
  INVALID_DELTA: "Nhập số lượng khác 0.",
};

// +/- on the inventory page → adjust_variant_stock(), called as the admin so the
// log records who did it. The change is sent to BigSeller with the next export.
export async function adjustStock(variantId: string, delta: number, reason: string): Promise<{ error?: string; stock?: number }> {
  await requireAdmin();
  if (!UUID.test(variantId)) return { error: ERRORS.VARIANT_NOT_FOUND };
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100_000) return { error: ERRORS.INVALID_DELTA };
  const why = (ADJUST_REASONS as readonly string[]).includes(reason) ? reason : null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("adjust_variant_stock", { p_variant_id: variantId, p_delta: delta, p_reason: why ?? undefined });
  if (error) return { error: ERRORS[error.message] ?? "Không thể cập nhật tồn kho. Vui lòng thử lại." };
  revalidatePath("/", "layout");
  return { stock: data };
}
