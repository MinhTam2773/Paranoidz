import { createAdminClient } from "@paranoidz/db/admin";
import { formatVnd } from "@/lib/format";
import { HOTLINE } from "@/lib/site";
import { TEST_PREFIX } from "@/lib/test-label";

// Order emails via Resend (ARCHITECTURE.md §4 step 4): the customer's confirmation (only if they
// gave an email) + the shop's new-order alert (ORDER_ALERT_EMAIL, also the reply-to). Called from
// after() so a slow or failed send never touches the order — failures are only logged.
// Overridden only in test environments, so test-order links open the preview / localhost.
const SITE_URL = process.env.SITE_URL || "https://paranoidz.vn";
const ADMIN_URL = process.env.ADMIN_URL || "https://admin.paranoidz.vn";
const FROM = "Paranoidz <donhang@paranoidz.vn>"; // not "noreply" (Resend deliverability insight); replies go to reply_to

type Order = {
  order_number: string; recipient_name: string; phone: string; secondary_phone: string | null; email: string | null;
  address: string; ward: string | null; city: string; note: string | null;
  subtotal: number; discount: number; shipping_fee: number; total: number;
  order_items: { name_snapshot: string; color_snapshot: string | null; size_snapshot: string | null; qty: number; price_snapshot: number }[];
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const row = (label: string, value: string, strong = false) =>
  `<tr><td style="padding:4px 0;color:#666666">${label}</td><td style="padding:4px 0;text-align:right;${strong ? "font-weight:700;color:#111111" : ""}">${value}</td></tr>`;
const button = (href: string, label: string) =>
  `<p style="margin:24px 0"><a href="${href}" style="display:inline-block;background:#111111;color:#ffffff;padding:12px 20px;text-decoration:none;font-weight:700;border-radius:4px">${label}</a></p>`;

function summary(o: Order) {
  const items = o.order_items.map((i) => {
    const variant = [i.color_snapshot, i.size_snapshot].filter(Boolean).join(" / ");
    return row(`${esc(i.name_snapshot)}${variant ? ` — ${esc(variant)}` : ""} × ${i.qty}`, formatVnd(i.price_snapshot * i.qty));
  });
  return `<table style="width:100%;border-collapse:collapse;font-size:14px">${items.join("")}
    <tr><td colspan="2" style="border-top:1px solid #e0e0e0;padding-top:8px"></td></tr>
    ${row("Tạm tính", formatVnd(o.subtotal))}
    ${o.discount ? row("Giảm giá", `<span style="color:#ff2d2d">−${formatVnd(o.discount)}</span>`) : ""}
    ${row("Phí vận chuyển", formatVnd(o.shipping_fee))}
    ${row("TỔNG THANH TOÁN KHI NHẬN HÀNG", formatVnd(o.total), true)}</table>`;
}

const address = (o: Order) => esc([o.address, o.ward, o.city].filter(Boolean).join(", "));

const layout = (title: string, body: string) =>
  `<div style="background:#f5f5f5;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#111111">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;padding:24px;border-radius:8px">
  <p style="margin:0 0 16px;font-size:20px;font-weight:800;font-style:italic">PARANOIDZ</p>
  <h1 style="margin:0 0 16px;font-size:18px">${TEST_PREFIX}${title}</h1>${body}
  <p style="margin:24px 0 0;font-size:12px;color:#999999">Hotline ${HOTLINE} · ${SITE_URL.replace("https://", "")}</p></div></div>`;

function customerEmail(o: Order) {
  const lookup = `${SITE_URL}/order-lookup?order=${encodeURIComponent(o.order_number)}`;
  return layout(`CẢM ƠN BẠN ĐÃ ĐẶT HÀNG — ${o.order_number}`,
    `<p style="font-size:14px;line-height:1.5">Chào ${esc(o.recipient_name)}, chúng tôi đã nhận đơn của bạn và sẽ gọi số
    <b>${esc(o.phone)}</b> để xác nhận trước khi giao. Bạn thanh toán bằng tiền mặt khi nhận hàng (COD).</p>
    ${summary(o)}
    <p style="font-size:14px;line-height:1.5">Giao đến: ${address(o)}</p>
    ${button(lookup, "THEO DÕI ĐƠN HÀNG")}
    <p style="font-size:14px;line-height:1.5">Cần thay đổi thông tin đơn hàng, vui lòng gọi ${HOTLINE} hoặc trả lời email này.</p>`);
}

function alertEmail(o: Order) {
  const phones = [o.phone, o.secondary_phone].filter(Boolean).join(" / ");
  return layout(`ĐƠN HÀNG MỚI — ${o.order_number}`,
    `<p style="font-size:14px;line-height:1.6"><b>${esc(o.recipient_name)}</b><br>${esc(phones)}${o.email ? `<br>${esc(o.email)}` : ""}
    <br>${address(o)}${o.note ? `<br>Ghi chú: ${esc(o.note)}` : ""}</p>
    ${summary(o)}${button(`${ADMIN_URL}/orders/${encodeURIComponent(o.order_number)}`, "MỞ ĐƠN TRONG TRANG QUẢN TRỊ")}`);
}

async function send(key: string, idempotencyKey: string, email: Record<string, unknown>) {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ from: FROM, ...email }),
    });
    if (!res.ok) console.error("order email failed", idempotencyKey, res.status, await res.text());
  } catch (sendError) {
    console.error("order email failed", idempotencyKey, sendError);
  }
}

export async function sendOrderEmails(orderId: string) {
  const key = process.env.RESEND_API_KEY;
  const alertTo = process.env.ORDER_ALERT_EMAIL;
  if (!key) return console.error("RESEND_API_KEY missing: order emails not sent");

  const { data, error } = await createAdminClient().from("orders")
    .select("order_number, recipient_name, phone, secondary_phone, email, address, ward, city, note, subtotal, discount, shipping_fee, total, order_items(name_snapshot, color_snapshot, size_snapshot, qty, price_snapshot)")
    .eq("id", orderId).single();
  if (error) return console.error("order email: order not readable", orderId, error);
  const o = data as Order;

  await Promise.all([
    // Test and prod order numbers come from separate sequences, so the prefix also keeps their
    // idempotency keys apart (Resend drops a repeated key within 24 h).
    o.email && send(key, `${TEST_PREFIX}${o.order_number}-customer`, {
      to: [o.email], subject: `${TEST_PREFIX}Xác nhận đơn hàng ${o.order_number}`, html: customerEmail(o), ...(alertTo && { reply_to: alertTo }),
    }),
    alertTo && send(key, `${TEST_PREFIX}${o.order_number}-alert`, {
      to: [alertTo], subject: `${TEST_PREFIX}Đơn mới ${o.order_number} — ${formatVnd(o.total)}`, html: alertEmail(o),
    }),
  ]);
}
