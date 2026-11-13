"use server";

import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { createAdminClient } from "@paranoidz/db/admin";
import type { UploadTicket } from "@paranoidz/db/media";
import { createUploadTicket, mediaExists } from "@paranoidz/db/media-server";
import { normalizePhone } from "@/lib/checkout-validation";
import { parseOrderNumber } from "@/lib/order-number";
import { sendReturnZaloAlert } from "@/lib/order-zalo";
import { hitRateLimit } from "@/lib/rate-limit";
import {
  MAX_RETURN_NOTE, MAX_RETURN_PHOTO_BYTES, MAX_RETURN_PHOTOS, RETURN_PHOTO_TYPES, RETURN_REASONS, type ReturnReason,
} from "@/lib/return-status";
import { HOTLINE } from "@/lib/site";

// Customer return requests (ARCHITECTURE.md §4 "Returns"), from the order lookup page. Guests have no
// session, so like lookupOrder() the caller proves the order with its number + phone, and everything
// runs with the service role. request_return() re-checks every rule in one transaction.
export type ReturnResult = { ok: true } | { ok: false; message: string };
type Failure = Extract<ReturnResult, { ok: false }>;

const BUCKET = "return-images";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PHOTO_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;
const FAILED: Failure = { ok: false, message: `Đã có lỗi xảy ra. Vui lòng thử lại hoặc gọi ${HOTLINE}.` };
const LIMITED: Failure = { ok: false, message: `Bạn đã thao tác quá nhiều lần. Vui lòng đợi một giờ rồi thử lại, hoặc gọi ${HOTLINE}.` };
const NOT_FOUND: Failure = { ok: false, message: "Không tìm thấy đơn hàng. Vui lòng tra cứu lại." };

const ERRORS: Record<string, string> = {
  ORDER_NOT_FOUND: NOT_FOUND.message,
  NOT_ELIGIBLE: "Chỉ đơn đã giao mới có thể yêu cầu trả hàng.",
  WINDOW_CLOSED: "Đã quá 7 ngày kể từ khi nhận hàng, đơn này không thể yêu cầu trả hàng online.",
  OPEN_REQUEST: "Đơn này đang có một yêu cầu trả hàng chưa xử lý xong.",
  BAD_ITEMS: "Sản phẩm hoặc số lượng chọn trả không hợp lệ. Vui lòng tra cứu lại đơn.",
  BAD_IMAGES: "Cần từ 1 đến 5 ảnh sản phẩm.",
  BAD_REASON: "Vui lòng chọn lý do (ghi rõ nếu chọn lý do khác).",
  CONDITIONS: "Sản phẩm trả phải chưa giặt và còn nguyên tem mác.",
};

// Number + phone in the format the lookup accepts, then one rate-limited hit of the "return" scope.
async function proveOrder(orderNumber: string, phone: string): Promise<{ id: string; status: string } | Failure> {
  const number = parseOrderNumber(String(orderNumber ?? ""));
  const normalized = normalizePhone(String(phone ?? ""));
  if (!number || !normalized) return NOT_FOUND;
  try {
    if (!(await hitRateLimit("return", normalized, { ip: 30, phone: 15 }))) return LIMITED;
  } catch (limitError) {
    console.error("hit_rate_limit failed", limitError);
    return FAILED;
  }
  const { data, error } = await createAdminClient()
    .from("orders").select("id, status").eq("order_number", number).eq("phone", normalized).maybeSingle();
  if (error) {
    console.error("return: order lookup failed", error);
    return FAILED;
  }
  return data ?? NOT_FOUND;
}

/** Upload ticket for one photo, under return-images/<order_id>/. */
export async function createReturnPhotoUpload(
  orderNumber: string,
  phone: string,
  contentType: string,
  size: number,
): Promise<{ ok: true; ticket: UploadTicket } | Failure> {
  const ext = Object.hasOwn(RETURN_PHOTO_TYPES, contentType) ? RETURN_PHOTO_TYPES[contentType] : null;
  if (!ext) return { ok: false, message: "Chỉ nhận ảnh JPG, PNG hoặc WebP." };
  if (!(size > 0 && size <= MAX_RETURN_PHOTO_BYTES)) return { ok: false, message: "Mỗi ảnh tối đa 5 MB." };
  const order = await proveOrder(orderNumber, phone);
  if ("ok" in order) return order;
  if (order.status !== "delivered") return { ok: false, message: ERRORS.NOT_ELIGIBLE };
  const ticket = await createUploadTicket(BUCKET, `${order.id}/${randomUUID()}.${ext}`, { contentType, size, cacheSeconds: 31536000 });
  if (!ticket) return { ok: false, message: "Không thể tải ảnh lên. Vui lòng thử lại." };
  return { ok: true, ticket };
}

export async function submitReturn(input: {
  orderNumber: string;
  phone: string;
  reason: ReturnReason;
  note: string;
  notWashed: boolean;
  tagsAttached: boolean;
  items: { orderItemId: string; qty: number }[];
  photos: string[]; // ticket paths: <order_id>/<uuid>.<ext>
}): Promise<ReturnResult> {
  const note = String(input?.note ?? "").trim();
  if (!RETURN_REASONS.some((r) => r.value === input?.reason) || (input.reason === "other" && !note) || note.length > MAX_RETURN_NOTE) {
    return { ok: false, message: ERRORS.BAD_REASON };
  }
  if (input.notWashed !== true || input.tagsAttached !== true) return { ok: false, message: ERRORS.CONDITIONS };
  const items = Array.isArray(input.items) ? input.items.filter((i) => UUID.test(String(i?.orderItemId)) && Number.isInteger(i.qty) && i.qty > 0) : [];
  if (!items.length || items.length !== input.items.length) return { ok: false, message: "Chọn ít nhất một sản phẩm muốn trả." };
  const photos = Array.isArray(input.photos) ? input.photos : [];
  if (photos.length < 1 || photos.length > MAX_RETURN_PHOTOS) return { ok: false, message: ERRORS.BAD_IMAGES };

  const order = await proveOrder(input.orderNumber, input.phone);
  if ("ok" in order) return order;
  const names: string[] = [];
  for (const path of photos) {
    const name = typeof path === "string" && path.startsWith(`${order.id}/`) ? path.slice(order.id.length + 1) : "";
    if (!PHOTO_FILE.test(name)) return { ok: false, message: "Đường dẫn ảnh không hợp lệ. Vui lòng chọn lại ảnh." };
    names.push(name);
  }
  const uploaded = await Promise.all(photos.map((p) => mediaExists(BUCKET, p)));
  if (uploaded.includes(false)) return { ok: false, message: "Ảnh chưa được tải lên xong. Vui lòng thử lại." };

  const { data, error } = await createAdminClient().rpc("request_return", {
    p_order_number: parseOrderNumber(input.orderNumber)!,
    p_phone: normalizePhone(input.phone)!,
    p_reason: input.reason,
    p_note: note,
    p_not_washed: true,
    p_tags_attached: true,
    p_items: items.map((i) => ({ order_item_id: i.orderItemId, qty: i.qty })),
    p_image_paths: names,
  });
  if (error) {
    if (ERRORS[error.message]) return { ok: false, message: ERRORS[error.message] };
    console.error("request_return failed", error);
    return FAILED;
  }
  after(() => sendReturnZaloAlert(data));
  return { ok: true };
}
