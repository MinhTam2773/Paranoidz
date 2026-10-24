"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@paranoidz/db/admin";
import { createClient } from "@paranoidz/db/server";
import { requireAdmin } from "@/lib/auth";
import { isOrderStatus, SPX_STATUS_LABEL, type OrderStatus } from "@/lib/order-status";
import { BULK_LIMIT, planShipments, spxProvince, type BulkFailure } from "@/lib/spx-bulk";
import { env, spxUserCall } from "@paranoidz/db/spx";
import { createOrderBody } from "@paranoidz/db/spx/order-body";
import { spxConfirms } from "@paranoidz/db/spx/webhook";

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

  // Đã giao / Giao thất bại are final, so a later SPX callback can't correct a wrong click: on an
  // order with an SPX shipment they need SPX to say so already.
  if (to === "delivered" || to === "delivery_failed") {
    const { data: order } = await createAdminClient().from("orders").select("spx_tracking_no").eq("id", orderId).maybeSingle();
    if (order?.spx_tracking_no) {
      const spxBlock = await spxStatusError(order.spx_tracking_no, to);
      if (spxBlock) return { error: spxBlock };
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

// Confirms a bank-transfer order's payment has arrived. Not a status change: the
// order stays pending and enters the normal flow (SPX shipment is what confirms
// it). The update only sticks on a transfer order that is still unconfirmed, so a
// second click — or a click after the order moved on — changes nothing.
export async function confirmBankTransferPayment(orderId: string): Promise<{ error?: string }> {
  await requireAdmin();
  const { data, error } = await createAdminClient()
    .from("orders")
    .update({ payment_confirmed_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("payment_method", "bank_transfer")
    .is("payment_confirmed_at", null)
    .select("id");
  if (error) return { error: "Không thể xác nhận thanh toán. Vui lòng thử lại." };
  if (!data.length) return { error: "Đơn này không phải đơn chuyển khoản chờ xác nhận. Trang đã được cập nhật." };
  revalidatePath("/", "layout");
  return {};
}

// SPX's own status for the parcel (1.3 Track Order); null when it allows `to`.
async function spxStatusError(trackingNo: string, to: "delivered" | "delivery_failed") {
  type Parcel = { tracking_no: string; status: string; status_code: string };
  try {
    const data = await spxUserCall<{ orders?: Parcel[]; fail_list?: SpxFailure[] }>("v1/order/batch_search_order", { tracking_no_list: [trackingNo] });
    const parcel = data.orders?.find((o) => o.tracking_no === trackingNo);
    if (!parcel) return spxError("Không kiểm tra được trạng thái với SPX", data.fail_list?.[0]);
    const code = Number(parcel.status_code);
    if (spxConfirms(to, code)) return null;
    const now = SPX_STATUS_LABEL[code] ?? parcel.status;
    return `SPX chưa báo ${to === "delivered" ? "đã giao" : "hoàn hàng"} (hiện tại: ${now}). Trạng thái đơn sẽ tự cập nhật khi SPX báo.`;
  } catch (e) {
    return spxError("Không kiểm tra được trạng thái với SPX", e);
  }
}

// Creates the SPX shipment for an order (DASHBOARD_DESIGN.md §6.2 "Vận chuyển SPX"). Creating it
// is what confirms a pending order — there is no confirmation call (decided 2026-10-16).
// `slot` = "<pickup_time>:<pickup_time_range_id>" from SPX's 1.1 list.
export async function createSpxShipment(orderId: string, ward: string, slot: string): Promise<{ error?: string }> {
  await requireAdmin();
  const pickup = parseSlot(slot);
  if (!pickup) return { error: "Chọn thời gian lấy hàng." };
  const { error } = await createShipment(orderId, ward, pickup);
  revalidatePath("/", "layout");
  return error ? { error } : {};
}

function parseSlot(slot: string) {
  const [pickupTime, rangeId] = slot.split(":").map(Number);
  return Number.isSafeInteger(pickupTime) && Number.isSafeInteger(rangeId) ? { pickupTime, rangeId } : null;
}

// Shared by the order page and the bulk action on /orders; callers check the admin and
// revalidate. Written with the service role; browsers can't write the spx_* columns.
async function createShipment(orderId: string, ward: string, pickup: { pickupTime: number; rangeId: number }): Promise<{ trackingNo?: string; error?: string }> {
  const admin = createAdminClient();
  const { data: order, error } = await admin
    .from("orders")
    .select("order_number, status, spx_tracking_no, spx_voucher, recipient_name, phone, address, note, city, subtotal, total, payment_method, payment_confirmed_at, order_items(name_snapshot, qty)")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw error;
  // `confirmed` without a shipment: confirmed by hand before 2026-10-16.
  // A bank-transfer order ships only after its payment is confirmed.
  if (!order || !SHIPPABLE.includes(order.status) || order.spx_tracking_no) {
    return { error: "Đơn đã có vận đơn SPX hoặc đã bị hủy. Trang đã được cập nhật." };
  }
  if (order.payment_method === "bank_transfer" && !order.payment_confirmed_at) {
    return { error: "Đơn chuyển khoản chưa được xác nhận thanh toán. Xác nhận đã nhận tiền trước khi tạo vận đơn SPX." };
  }

  const province = spxProvince(order.city);
  const { count } = await admin.from("spx_locations").select("*", { count: "exact", head: true }).eq("province", province).eq("ward", ward);
  if (!count) return { error: "Chọn phường / xã giao hàng." };

  const body = (voucher: string | null) => createOrderBody(
    { ...order, items: order.order_items.map((i) => ({ name: i.name_snapshot, qty: i.qty })) },
    province,
    ward,
    pickup,
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

  // Only the first shipment sticks: one created in parallel by a second click, or for an order
  // cancelled meanwhile, is cancelled at SPX.
  const { data: saved, error: saveError } = await admin
    .from("orders")
    .update({ spx_tracking_no: created.tracking_no, spx_ward: ward, spx_fee: created.estimated_shipping_fee, spx_created_at: new Date().toISOString() })
    .eq("id", orderId)
    .is("spx_tracking_no", null)
    .in("status", SHIPPABLE)
    .select("id");
  if (saveError || !saved.length) {
    await cancelSpxShipment(created.tracking_no).catch(() => {});
    return { error: `Không lưu được vận đơn ${created.tracking_no} nên đã hủy nó ở SPX. Trang đã được cập nhật.` };
  }

  // The shipment is kept even if this fails: the SPX webhook walks the order on from pending.
  if (order.status === "pending") {
    const { error: confirmError } = await admin.rpc("transition_order_status", { p_order_id: orderId, p_new_status: "confirmed" });
    if (confirmError) return { trackingNo: created.tracking_no, error: `Đã tạo vận đơn ${created.tracking_no} nhưng chưa cập nhật được trạng thái đơn; trạng thái sẽ tự cập nhật khi SPX lấy hàng.` };
  }
  return { trackingNo: created.tracking_no };
}

const SHIPPABLE: OrderStatus[] = ["pending", "confirmed"];

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

export type BulkResult = { created: number; failed: BulkFailure[]; url?: string; error?: string };

// Bulk "TẠO ĐƠN SPX & IN PHIẾU" on /orders (DASHBOARD_DESIGN.md §6.2): one pickup slot for every
// ticked pending order, each created like on its own page, then one label link for all of them.
export async function createSpxShipments(orderIds: string[], slot: string): Promise<BulkResult> {
  await requireAdmin();
  const pickup = parseSlot(slot);
  if (!pickup) return { created: 0, failed: [], error: "Chọn thời gian lấy hàng." };
  if (!orderIds.length || orderIds.length > BULK_LIMIT) return { created: 0, failed: [], error: `Chọn từ 1 đến ${BULK_LIMIT} đơn.` };

  const admin = createAdminClient();
  const { data: orders, error } = await admin.from("orders").select("id, order_number, status, spx_tracking_no, city, ward, payment_method, payment_confirmed_at").in("id", orderIds);
  if (error) throw error;
  // One query per province: a province has at most a few hundred wards, under PostgREST's row cap.
  const provinces = [...new Set(orders.map((o) => spxProvince(o.city)))];
  const wards = new Map(await Promise.all(provinces.map(async (province) => {
    const { data, error: wardError } = await admin.from("spx_locations").select("ward").eq("province", province);
    if (wardError) throw wardError;
    return [province, data.map((r) => r.ward)] as const;
  })));
  const { ready, skipped } = planShipments(orders, wards);

  // A few at a time: each SPX call takes 1–2 s.
  const results: { orderNumber: string; trackingNo?: string; error?: string }[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < ready.length) {
      const o = ready[next++];
      const r = await createShipment(o.id, o.ward, pickup).catch(() => ({ trackingNo: undefined, error: "Không tạo được đơn SPX. Vui lòng thử lại." }));
      results.push({ orderNumber: o.orderNumber, ...r });
    }
  }));
  revalidatePath("/", "layout");

  const failed = [...skipped, ...results.flatMap((r) => (r.error ? [{ orderNumber: r.orderNumber, reason: r.error }] : []))];
  const trackingNos = results.flatMap((r) => (r.trackingNo ? [r.trackingNo] : []));
  if (!trackingNos.length) return { created: 0, failed };
  const label = await labelLink(trackingNos);
  return { created: trackingNos.length, failed, ...label };
}

// IN PHIẾU (n) on the Đã tạo vận đơn tab.
export async function getSpxLabels(orderIds: string[]): Promise<BulkResult> {
  await requireAdmin();
  if (!orderIds.length || orderIds.length > BULK_LIMIT) return { created: 0, failed: [], error: `Chọn từ 1 đến ${BULK_LIMIT} đơn.` };
  const { data: orders, error } = await createAdminClient().from("orders").select("spx_tracking_no").in("id", orderIds).not("spx_tracking_no", "is", null);
  if (error) throw error;
  if (!orders.length) return { created: 0, failed: [], error: "Các đơn đã chọn chưa có vận đơn SPX." };
  return { created: 0, failed: [], ...(await labelLink(orders.map((o) => o.spx_tracking_no!))) };
}

// One call, one link for every tracking number SPX knows (checked on the test host 2026-10-16: no
// limit up to 101; unknown numbers come back in fail_list while the link covers the rest).
async function labelLink(trackingNos: string[]): Promise<{ url?: string; error?: string }> {
  try {
    const data = await spxUserCall<{ awb_link?: string; fail_list?: (SpxFailure & { tracking_no?: string })[] }>("v1/order/batch_get_shipping_label", { tracking_no_list: trackingNos });
    const missing = data.fail_list?.map((f) => f.tracking_no).join(", ");
    if (!data.awb_link) return { error: spxError("Không lấy được phiếu gửi hàng", data.fail_list?.[0]) };
    return { url: data.awb_link, ...(missing && { error: `Phiếu không có vận đơn ${missing} (SPX: ${data.fail_list![0].message}).` }) };
  } catch (e) {
    return { error: spxError("Không lấy được phiếu gửi hàng", e) };
  }
}
