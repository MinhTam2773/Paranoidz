"use server";

import { createAdminClient } from "@paranoidz/db/admin";
import type { Database } from "@paranoidz/db/types";
import { normalizePhone } from "@/lib/checkout-validation";
import { parseOrderNumber } from "@/lib/order-number";
import { hitRateLimit } from "@/lib/rate-limit";
import { HOTLINE } from "@/lib/site";

export type LookedUpOrder = {
  orderNumber: string;
  status: Database["public"]["Enums"]["order_status"];
  createdAt: string;
  ward: string | null;
  city: string;
  subtotal: number;
  discount: number;
  total: number;
  items: { name: string; color: string | null; size: string | null; qty: number; price: number; imageUrl: string | null }[];
};

export type LookupResult =
  | { ok: true; order: LookedUpOrder }
  | { ok: false; message: string; field?: "orderNumber" | "phone" };

const FAILED: LookupResult = { ok: false, message: `Something went wrong. Please try again or call ${HOTLINE}.` };

// Guest order lookup (ARCHITECTURE.md §2.4): order number + the order's phone. Orders are
// own-row-only under RLS and guests have no session, so this reads with the admin client and
// returns only what the customer needs to follow the order — no name, street address, phones,
// email or note, since sequential order numbers + a known phone are guessable. Rate limited per
// IP + phone; wrong number and wrong phone get the same answer.
export async function lookupOrder(input: { orderNumber: string; phone: string }): Promise<LookupResult> {
  const orderNumber = parseOrderNumber(String(input?.orderNumber ?? ""));
  const phone = normalizePhone(String(input?.phone ?? ""));
  if (!orderNumber) return { ok: false, field: "orderNumber", message: "Enter your order number, e.g. PZ-2026-0123." };
  if (!phone) {
    return { ok: false, field: "phone", message: "Enter the phone number you ordered with: 10 digits starting with 03, 05, 07, 08 or 09." };
  }

  try {
    if (!(await hitRateLimit("lookup", phone, { ip: 20, phone: 10 }))) {
      return { ok: false, message: `Too many lookups. Please wait an hour and try again, or call ${HOTLINE}.` };
    }
  } catch (limitError) {
    console.error("hit_rate_limit failed", limitError);
    return FAILED;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("orders")
    .select("order_number, status, created_at, ward, city, subtotal, discount, total, order_items(name_snapshot, color_snapshot, size_snapshot, qty, price_snapshot, image_snapshot)")
    .eq("order_number", orderNumber)
    .eq("phone", phone)
    .maybeSingle();
  if (error) {
    console.error("order lookup failed", error);
    return FAILED;
  }
  if (!data) return { ok: false, message: `No order matches that order number and phone number. Check both, or call ${HOTLINE}.` };

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
      total: data.total,
      items: data.order_items.map((i) => ({
        name: i.name_snapshot,
        color: i.color_snapshot,
        size: i.size_snapshot,
        qty: i.qty,
        price: i.price_snapshot,
        imageUrl: i.image_snapshot ? admin.storage.from("product-images").getPublicUrl(i.image_snapshot).data.publicUrl : null,
      })),
    },
  };
}
