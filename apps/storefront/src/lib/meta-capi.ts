import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { createAdminClient } from "@paranoidz/db/admin";
import { SITE_URL } from "@/lib/site";

// Purchase through Meta's Conversions API, next to the browser pixel's (components/tracking/MetaPixel):
// same event_id (the order number), so Meta counts it once, and it still lands when an ad blocker or
// a closed tab stops the pixel. The hashed phone / email let Meta match COD buyers to ad clicks.
// Called from after() in placeOrder like the order emails: an unset token (everywhere but Vercel
// Production) or a failed send is only logged, never touches the order.
const PIXEL_ID = "1535409166877970"; // same pixel as components/tracking/MetaPixel.tsx
const GRAPH_VERSION = "v23.0";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

// "0912 345 678" → "84912345678": Meta wants the country code and digits only, before hashing.
const metaPhone = (phone: string) => phone.replace(/\D/g, "").replace(/^0/, "84");

export async function sendMetaPurchase(orderId: string) {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) return;

  const { data, error } = await createAdminClient().from("orders")
    .select("order_number, phone, email, total, order_items(variant_id, qty, price_snapshot)")
    .eq("id", orderId).single();
  if (error) return console.error("meta capi: order not readable", orderId, error);

  const [h, c] = await Promise.all([headers(), cookies()]);
  const contents = data.order_items.flatMap((i) =>
    i.variant_id ? [{ id: i.variant_id, quantity: i.qty, item_price: i.price_snapshot }] : [],
  );
  const event = {
    event_name: "Purchase",
    event_time: Math.floor(Date.now() / 1000),
    event_id: data.order_number,
    event_source_url: `${SITE_URL}/checkout`,
    action_source: "website",
    user_data: {
      ph: [sha256(metaPhone(data.phone))],
      ...(data.email ? { em: [sha256(data.email.trim().toLowerCase())] } : {}),
      country: [sha256("vn")],
      client_ip_address: h.get("x-forwarded-for")?.split(",")[0].trim(),
      client_user_agent: h.get("user-agent") ?? undefined,
      fbp: c.get("_fbp")?.value,
      fbc: c.get("_fbc")?.value,
    },
    custom_data: {
      content_type: "product",
      content_ids: contents.map((i) => i.id),
      contents,
      num_items: contents.reduce((n, i) => n + i.quantity, 0),
      value: data.total,
      currency: "VND",
    },
  };

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${PIXEL_ID}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: [event], access_token: token }),
    });
    if (!res.ok) console.error("meta capi failed", data.order_number, res.status, await res.text());
  } catch (sendError) {
    console.error("meta capi failed", data.order_number, sendError);
  }
}
