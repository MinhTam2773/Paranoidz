"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@paranoidz/db/server";
import { requireAdmin } from "@/lib/auth";
import { isOrderStatus } from "@/lib/order-status";

// The only way the admin changes an order's status. Called as the signed-in admin
// (not service_role), so transition_order_status() runs its own is_admin check
// and enforces the valid transitions, stock restore and counters.
export async function transitionOrder(orderId: string, to: string): Promise<{ error?: string }> {
  await requireAdmin();
  if (!isOrderStatus(to)) return { error: "Trạng thái không hợp lệ." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_order_status", { p_order_id: orderId, p_new_status: to });
  const stale = error?.message.startsWith("INVALID_TRANSITION");
  if (error && !stale) return { error: "Không thể cập nhật đơn. Vui lòng thử lại." };

  // Whole shell: the detail page, the list and the sidebar's pending count. Also
  // when the status was changed elsewhere, so the page shows the real one.
  revalidatePath("/", "layout");
  return stale ? { error: "Trạng thái đơn đã được thay đổi ở nơi khác. Trang đã được cập nhật." } : {};
}
