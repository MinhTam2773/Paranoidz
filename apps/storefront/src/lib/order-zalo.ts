import { createAdminClient } from "@paranoidz/db/admin";
import { formatVnd } from "@/lib/format";
import { TEST_PREFIX } from "@/lib/test-label";

// New-order alert to the client's Zalo (ARCHITECTURE.md §4 step 4) via the Zalo Bot Platform
// (bot.zapps.me). Called from after() like the order emails: unset env or a failed send is only
// logged, never touches the order. Plain text (no parse_mode) so customer-typed text needs no escaping.
const ADMIN_URL = process.env.ADMIN_URL || "https://admin.paranoidz.vn"; // overridden only in test environments
const MAX_TEXT = 2000; // sendMessage limit

type Order = {
  order_number: string; recipient_name: string; phone: string; secondary_phone: string | null;
  address: string; ward: string | null; city: string; note: string | null;
  subtotal: number; discount: number; shipping_fee: number; total: number; payment_method: string;
  order_items: { name_snapshot: string; color_snapshot: string | null; size_snapshot: string | null; qty: number }[];
};

export function zaloAlertText(o: Order) {
  const items = o.order_items.map((i) => {
    const variant = [i.color_snapshot, i.size_snapshot].filter(Boolean).join(" / ");
    return `${i.qty} × ${i.name_snapshot}${variant ? ` (${variant})` : ""}`;
  });
  const totals = [
    `Tạm tính ${formatVnd(o.subtotal)}`,
    o.discount ? `Giảm −${formatVnd(o.discount)}` : "",
    `Ship ${formatVnd(o.shipping_fee)}`,
  ].filter(Boolean).join(" · ");
  return [
    `${TEST_PREFIX}🛒 ĐƠN MỚI ${o.order_number}`,
    `${o.recipient_name} · ${[o.phone, o.secondary_phone].filter(Boolean).join(" / ")}`,
    [o.address, o.ward, o.city].filter(Boolean).join(", "),
    "─────", ...items, "─────",
    totals,
    o.payment_method === "bank_transfer" ? `CHỜ CHUYỂN KHOẢN: ${formatVnd(o.total)} (xác nhận rồi mới giao)` : `THU COD: ${formatVnd(o.total)}`,
    o.note ? `Ghi chú: ${o.note}` : "",
    `${ADMIN_URL}/orders/${encodeURIComponent(o.order_number)}`,
  ].filter(Boolean).join("\n").slice(0, MAX_TEXT);
}

export async function sendZaloAlert(orderId: string) {
  const token = process.env.ZALO_BOT_TOKEN;
  const chatId = process.env.ZALO_OWNER_CHAT_ID;
  if (!token || !chatId) return console.warn("ZALO_BOT_TOKEN / ZALO_OWNER_CHAT_ID unset: Zalo alert skipped");

  const { data, error } = await createAdminClient().from("orders")
    .select("order_number, recipient_name, phone, secondary_phone, address, ward, city, note, subtotal, discount, shipping_fee, total, payment_method, order_items(name_snapshot, color_snapshot, size_snapshot, qty)")
    .eq("id", orderId).single();
  if (error) return console.error("zalo alert: order not readable", orderId, error);

  try {
    const res = await fetch(`https://bot-api.zaloplatforms.com/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: zaloAlertText(data as Order) }),
    });
    // Zalo reports errors as HTTP 200 + { ok: false }: judge by the body, not the status.
    const body = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    if (!body?.ok) console.error("zalo alert failed", data.order_number, res.status, body);
  } catch (sendError) {
    console.error("zalo alert failed", data.order_number, sendError);
  }
}
