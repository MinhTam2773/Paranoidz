"use server";

import { createAdminClient } from "@paranoidz/db/admin";
import { mediaUrl } from "@paranoidz/db/media";
import type { Database } from "@paranoidz/db/types";
import { normalizePhone } from "@/lib/checkout-validation";
import { parseOrderNumber } from "@/lib/order-number";
import { hitRateLimit } from "@/lib/rate-limit";
import { canRequestReturn, returnDeadline, returnableQty, type ReturnStatus } from "@/lib/return-status";
import { HOTLINE } from "@/lib/site";

export type LookedUpOrder = {
  orderNumber: string;
  status: Database["public"]["Enums"]["order_status"];
  createdAt: string;
  ward: string | null;
  city: string;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  spxTrackingNo: string | null;
  paymentMethod: string;
  paymentConfirmed: boolean;
  items: { id: string; name: string; color: string | null; size: string | null; qty: number; price: number; imageUrl: string | null; isGift: boolean; returnable: number }[];
  // Returns (ARCHITECTURE.md §4 "Returns"): the latest request, and whether a new one may be sent.
  canReturn: boolean;
  returnDaysLeft: number; // whole days left to ask, rounded up (0 when closed)
  latestReturn: { status: ReturnStatus; adminNote: string | null; createdAt: string } | null;
};

export type LookupResult =
  | { ok: true; order: LookedUpOrder }
  | { ok: false; message: string; field?: "orderNumber" | "phone" };

const FAILED: LookupResult = { ok: false, message: `Đã có lỗi xảy ra. Vui lòng thử lại hoặc gọi ${HOTLINE}.` };

// Guest order lookup (ARCHITECTURE.md §2.4): order number + the order's phone. Orders are
// own-row-only under RLS and guests have no session, so this reads with the admin client and
// returns only what the customer needs to follow the order — no name, street address, phones,
// email or note, since sequential order numbers + a known phone are guessable. Rate limited per
// IP + phone; wrong number and wrong phone get the same answer.
export async function lookupOrder(input: { orderNumber: string; phone: string }): Promise<LookupResult> {
  const orderNumber = parseOrderNumber(String(input?.orderNumber ?? ""));
  const phone = normalizePhone(String(input?.phone ?? ""));
  if (!orderNumber) return { ok: false, field: "orderNumber", message: "Nhập mã đơn hàng, ví dụ PZ-2026-0123." };
  if (!phone) {
    return { ok: false, field: "phone", message: "Nhập số điện thoại đã dùng khi đặt hàng: 10 chữ số, bắt đầu bằng 03, 05, 07, 08 hoặc 09." };
  }

  try {
    if (!(await hitRateLimit("lookup", phone, { ip: 20, phone: 10 }))) {
      return { ok: false, message: `Bạn đã tra cứu quá nhiều lần. Vui lòng đợi một giờ rồi thử lại, hoặc gọi ${HOTLINE}.` };
    }
  } catch (limitError) {
    console.error("hit_rate_limit failed", limitError);
    return FAILED;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("orders")
    .select("order_number, status, created_at, ward, city, subtotal, discount, shipping_fee, shipping_discount, total, spx_tracking_no, payment_method, payment_confirmed_at, order_items(id, name_snapshot, color_snapshot, size_snapshot, qty, price_snapshot, image_snapshot, is_gift), order_status_history(status, created_at), return_requests(status, admin_note, created_at, return_items(order_item_id, qty))")
    .eq("order_number", orderNumber)
    .eq("phone", phone)
    .maybeSingle();
  if (error) {
    console.error("order lookup failed", error);
    return FAILED;
  }
  if (!data) return { ok: false, message: `Không tìm thấy đơn hàng khớp với mã đơn và số điện thoại này. Hãy kiểm tra lại, hoặc gọi ${HOTLINE}.` };

  const deliveredAt = data.order_status_history.filter((h) => h.status === "delivered").map((h) => h.created_at).sort().at(-1) ?? null;
  const lines = data.order_items.map((i) => ({ id: i.id, qty: i.qty, isGift: i.is_gift }));
  const requests = [...data.return_requests]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((r) => ({ ...r, items: r.return_items.map((i) => ({ orderItemId: i.order_item_id, qty: i.qty })) }));
  const returnable = returnableQty(lines, requests);
  const latest = requests[0];

  return {
    ok: true,
    order: {
      orderNumber: data.order_number,
      status: data.status,
      createdAt: data.created_at,
      ward: data.ward,
      city: data.city,
      subtotal: data.subtotal,
      discount: data.discount,
      shippingFee: data.shipping_fee - data.shipping_discount, // after free shipping (pricing v2)
      total: data.total,
      spxTrackingNo: data.spx_tracking_no,
      paymentMethod: data.payment_method ?? "cod",
      paymentConfirmed: data.payment_confirmed_at !== null,
      items: data.order_items.map((i) => ({
        id: i.id,
        name: i.name_snapshot,
        color: i.color_snapshot,
        size: i.size_snapshot,
        qty: i.qty,
        price: i.price_snapshot,
        imageUrl: i.image_snapshot ? mediaUrl("product-images", i.image_snapshot) : null,
        isGift: i.is_gift,
        returnable: returnable[i.id] ?? 0,
      })),
      canReturn: canRequestReturn({ status: data.status, deliveredAt, lines, requests }),
      returnDaysLeft: Math.max(0, Math.ceil(((returnDeadline(deliveredAt)?.getTime() ?? 0) - Date.now()) / 86_400_000)),
      latestReturn: latest ? { status: latest.status, adminNote: latest.admin_note, createdAt: latest.created_at } : null,
    },
  };
}
