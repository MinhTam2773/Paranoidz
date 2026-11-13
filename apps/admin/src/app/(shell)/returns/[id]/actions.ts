"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@paranoidz/db/server";
import { requireAdmin } from "@/lib/auth";
import { RETURN_STATUS_LABEL, type ReturnStatus } from "@/lib/returns";
import { revalidateStorefront } from "@/lib/storefront";

const ERRORS: Record<string, string> = {
  NOTE_REQUIRED: "Ghi lý do từ chối (khách sẽ thấy lý do này).",
  TRACKING_REQUIRED: "Nhập mã vận đơn SPX lấy hàng.",
  AMOUNT_REQUIRED: "Nhập số tiền đã hoàn.",
  NOTE_TOO_LONG: "Ghi chú tối đa 500 ký tự.",
};

// Every move goes through transition_return() as the signed-in admin (it checks is_admin and the
// allowed moves; → received puts the units back in stock).
export async function moveReturn(
  returnId: string,
  to: ReturnStatus,
  extra: { note?: string; tracking?: string; amount?: number } = {},
): Promise<{ error?: string; ok?: string }> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_return", {
    p_return_id: returnId,
    p_new_status: to,
    p_note: extra.note?.trim() || undefined,
    p_spx_tracking_no: extra.tracking?.trim() || undefined,
    p_refund_amount: extra.amount,
  });
  const stale = error?.message.startsWith("INVALID_TRANSITION");
  if (error && !stale) return { error: ERRORS[error.message] ?? "Không thể cập nhật yêu cầu trả hàng. Vui lòng thử lại." };

  // Detail, list, the order page and the sidebar count.
  revalidatePath("/", "layout");
  // Received: stock is back, which the storefront shows.
  if (!error && to === "received") revalidateStorefront();
  return stale ? { error: "Yêu cầu đã được thay đổi ở nơi khác. Trang đã được cập nhật." } : { ok: RETURN_STATUS_LABEL[to] };
}
