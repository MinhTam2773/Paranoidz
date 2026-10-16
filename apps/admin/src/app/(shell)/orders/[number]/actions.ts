"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@paranoidz/db/admin";
import { PROVINCES } from "@paranoidz/db/provinces";
import { createClient } from "@paranoidz/db/server";
import { requireAdmin } from "@/lib/auth";
import { isOrderStatus } from "@/lib/order-status";
import { env, spxUserCall } from "@paranoidz/db/spx";
import { createOrderBody } from "@paranoidz/db/spx/order-body";

type SpxFailure = { message: string };

// "<what failed> (SPX: <SPX's own reason>)"; timeouts and network errors get a plain sentence.
function spxError(what: string, e: unknown) {
  if (e instanceof Error && (e.name === "TimeoutError" || e.name === "TypeError")) return `${what}: SPX không phản hồi. Vui lòng thử lại.`;
  // fail_list's debug_msg is a dump of the whole request, so only `message` is shown.
  const reason = e instanceof Error ? e.message : (e as SpxFailure | undefined)?.message;
  return `${what} (SPX: ${reason || "không rõ lý do"})`;
}

async function cancelSpxShipment(trackingNo: string) {
  const data = await spxUserCall<{ fail_list?: SpxFailure[] }>("v1/order/batch_cancel_order", { tracking_no_list: [trackingNo] });
  if (data.fail_list?.length) throw data.fail_list[0];
}

// The only way the admin changes an order's status. Called as the signed-in admin
// (not service_role), so transition_order_status() runs its own is_admin check
// and enforces the valid transitions, stock restore and counters.
export async function transitionOrder(orderId: string, to: string): Promise<{ error?: string }> {
  await requireAdmin();
  if (!isOrderStatus(to)) return { error: "Trạng thái không hợp lệ." };

  // An order with an SPX shipment is cancelled at SPX first; if SPX refuses (already
  // picked up), the order stays as it is.
  if (to === "cancelled") {
    const { data: order } = await createAdminClient().from("orders").select("spx_tracking_no").eq("id", orderId).maybeSingle();
    if (order?.spx_tracking_no) {
      try {
        await cancelSpxShipment(order.spx_tracking_no);
      } catch (e) {
        return { error: spxError("Không hủy được đơn SPX nên đơn chưa bị hủy", e) };
      }
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_order_status", { p_order_id: orderId, p_new_status: to });
  const stale = error?.message.startsWith("INVALID_TRANSITION");
  if (error && !stale) return { error: "Không thể cập nhật đơn. Vui lòng thử lại." };

  // Whole shell: the detail page, the list and the sidebar's pending count. Also
  // when the status was changed elsewhere, so the page shows the real one.
  revalidatePath("/", "layout");
  return stale ? { error: "Trạng thái đơn đã được thay đổi ở nơi khác. Trang đã được cập nhật." } : {};
}

// Creates the SPX shipment for a confirmed order (DASHBOARD_DESIGN.md §6.2 "Vận chuyển SPX").
// `slot` = "<pickup_time>:<pickup_time_range_id>" from SPX's 1.1 list. Written with the
// service role; browsers can't write the spx_* columns.
export async function createSpxShipment(orderId: string, ward: string, slot: string): Promise<{ error?: string }> {
  await requireAdmin();
  const [pickupTime, rangeId] = slot.split(":").map(Number);
  if (!Number.isSafeInteger(pickupTime) || !Number.isSafeInteger(rangeId)) return { error: "Chọn thời gian lấy hàng." };

  const admin = createAdminClient();
  const { data: order, error } = await admin
    .from("orders")
    .select("order_number, status, spx_tracking_no, spx_voucher, recipient_name, phone, address, note, city, subtotal, total, order_items(name_snapshot, qty)")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw error;
  if (!order || order.status !== "confirmed" || order.spx_tracking_no) {
    revalidatePath("/", "layout");
    return { error: "Đơn đã có vận đơn SPX hoặc không còn ở trạng thái Đã xác nhận. Trang đã được cập nhật." };
  }

  const province = PROVINCES.find((p) => p.name === order.city)?.spx ?? "";
  const { count } = await admin.from("spx_locations").select("*", { count: "exact", head: true }).eq("province", province).eq("ward", ward);
  if (!count) return { error: "Chọn phường / xã giao hàng." };

  const body = (voucher: string | null) => createOrderBody(
    { ...order, items: order.order_items.map((i) => ({ name: i.name_snapshot, qty: i.qty })) },
    province,
    ward,
    { pickupTime, rangeId },
    { name: env("SPX_SENDER_NAME"), phone: env("SPX_SENDER_PHONE"), address: env("SPX_SENDER_ADDRESS"), ward: env("SPX_SENDER_WARD"), province: env("SPX_SENDER_PROVINCE") },
    voucher,
  );
  type Created = { tracking_no: string; estimated_shipping_fee: number };
  const create = async (voucher: string | null): Promise<{ created?: Created; failure?: unknown }> => {
    try {
      const data = await spxUserCall<{ orders?: Created[]; fail_list?: SpxFailure[] }>("v1/order/batch_create_order", { orders: [body(voucher)] });
      return data.orders?.length ? { created: data.orders[0] } : { failure: data.fail_list?.[0] };
    } catch (e) {
      return { failure: e };
    }
  };
  // The checkout's SPX voucher (ARCHITECTURE.md §5): if SPX no longer accepts it (expired, used
  // up), create without it — the customer's fee is final, the difference is the shop's.
  let result = await create(order.spx_voucher);
  if (!result.created && order.spx_voucher && /voucher/i.test(String((result.failure as SpxFailure | undefined)?.message))) {
    result = await create(null);
  }
  const created = result.created;
  if (!created) return { error: spxError("Không tạo được đơn SPX", result.failure) };

  // Only the first shipment sticks: one created in parallel by a second click is cancelled at SPX.
  const { data: saved, error: saveError } = await admin
    .from("orders")
    .update({ spx_tracking_no: created.tracking_no, spx_ward: ward, spx_fee: created.estimated_shipping_fee, spx_created_at: new Date().toISOString() })
    .eq("id", orderId)
    .is("spx_tracking_no", null)
    .select("id");
  if (saveError || !saved.length) {
    await cancelSpxShipment(created.tracking_no).catch(() => {});
    revalidatePath("/", "layout");
    return { error: `Không lưu được vận đơn ${created.tracking_no} nên đã hủy nó ở SPX. Trang đã được cập nhật.` };
  }

  revalidatePath("/", "layout");
  return {};
}

// A fresh label link on every click: SPX's link lasts 30 minutes / 10 opens, so it is never stored.
export async function getSpxLabel(orderId: string): Promise<{ url?: string; error?: string }> {
  await requireAdmin();
  const { data: order } = await createAdminClient().from("orders").select("spx_tracking_no").eq("id", orderId).maybeSingle();
  if (!order?.spx_tracking_no) return { error: "Đơn chưa có vận đơn SPX." };
  try {
    const data = await spxUserCall<{ awb_link?: string; fail_list?: SpxFailure[] }>("v1/order/batch_get_shipping_label", { tracking_no_list: [order.spx_tracking_no] });
    if (!data.awb_link || data.fail_list?.length) return { error: spxError("Không lấy được phiếu gửi hàng", data.fail_list?.[0]) };
    return { url: data.awb_link };
  } catch (e) {
    return { error: spxError("Không lấy được phiếu gửi hàng", e) };
  }
}
