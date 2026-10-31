"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@paranoidz/db/admin";
import { requireAdmin } from "@/lib/auth";
import { vnDate } from "@/lib/format";

// Promo codes (DASHBOARD_DESIGN.md §6.7). Rules mirror place_order(): it matches
// upper(trim(code)), type 'promo', is_active, expires_at > now(), used_count < max_uses.
// Pricing v2 adds 'standing' (every order, not once per phone) and is_listed (checkout
// picker); place_order() honours them only from PR C on. Every write is scoped to
// EDITABLE so the system AUTO-FIRST5 voucher can't be touched here.

const EDITABLE = ["promo", "standing"] as const;
export type PromoType = (typeof EDITABLE)[number];

export type PromoInput = {
  id?: string;
  type: PromoType;
  code: string;
  discountPct: string;
  capAmount: string;
  maxUses: string;
  expiresOn: string; // "yyyy-mm-dd", Vietnam date; "" = never expires
  isActive: boolean;
  isListed: boolean;
};
export type PromoResult = { errors?: Record<string, string>; id?: string };

const done = () => revalidatePath("/promo-codes", "layout");
const int = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : NaN);

export async function savePromoCode(input: PromoInput): Promise<PromoResult> {
  await requireAdmin();
  const admin = createAdminClient();

  let current: { code: string; discount_pct: number; cap_amount: number | null; used_count: number; expires_at: string | null } | null = null;
  let locked = false; // already priced orders → type / code / % / cap are fixed
  if (input.id) {
    const [{ data }, { count }] = await Promise.all([
      admin.from("vouchers").select("code, discount_pct, cap_amount, used_count, expires_at").eq("id", input.id).in("type", EDITABLE).maybeSingle(),
      admin.from("voucher_uses").select("id", { count: "exact", head: true }).eq("voucher_id", input.id),
    ]);
    if (!data) return { errors: { form: "Mã không còn tồn tại. Tải lại trang." } };
    current = data;
    locked = (count ?? 0) > 0;
  }

  const errors: Record<string, string> = {};
  const code = input.code.trim().toUpperCase();
  const discountPct = int(input.discountPct);
  const capAmount = input.capAmount.trim() ? int(input.capAmount) : null;
  const maxUses = input.maxUses.trim() ? int(input.maxUses) : null;
  const expiresOn = input.expiresOn.trim();
  if (!locked) {
    if (!(EDITABLE as readonly string[]).includes(input.type)) errors.type = "Chọn loại mã.";
    if (!/^[A-Z0-9-]{3,30}$/.test(code)) errors.code = "3–30 ký tự: chữ không dấu, số và dấu gạch ngang.";
    if (!(discountPct >= 1 && discountPct <= 100)) errors.discountPct = "Nhập số nguyên từ 1 đến 100.";
    if (capAmount !== null && !(capAmount >= 1000 && capAmount <= 100_000_000)) errors.capAmount = "Từ ₫1.000 đến ₫100.000.000, hoặc để trống.";
  }
  if (maxUses !== null && !(maxUses >= 1 && maxUses <= 1_000_000)) errors.maxUses = "Nhập số nguyên dương, hoặc để trống.";
  else if (maxUses !== null && current && maxUses < current.used_count) errors.maxUses = `Đã có ${current.used_count} lượt dùng — không thể đặt thấp hơn.`;
  const unchangedExpiry = current?.expires_at ? vnDate(current.expires_at) === expiresOn : false;
  if (expiresOn && !unchangedExpiry) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresOn) || Number.isNaN(Date.parse(expiresOn))) errors.expiresOn = "Ngày không hợp lệ.";
    else if (expiresOn < vnDate()) errors.expiresOn = "Ngày hết hạn đã qua.";
  }
  if (Object.keys(errors).length) return { errors };

  const fields = {
    max_uses: maxUses,
    is_active: input.isActive,
    is_listed: input.isListed,
    // end of that day in Vietnam; place_order() accepts the code while expires_at > now()
    expires_at: expiresOn ? (unchangedExpiry ? current!.expires_at : `${expiresOn}T23:59:59.999+07:00`) : null,
    ...(locked ? {} : { type: input.type, code, discount_pct: discountPct, cap_amount: capAmount }),
  };
  const duplicate = { errors: { code: "Mã này đã tồn tại." } };

  if (!input.id) {
    const { data, error } = await admin
      .from("vouchers").insert({ ...fields, type: input.type, code, discount_pct: discountPct, cap_amount: capAmount }).select("id").single();
    if (error) return error.code === "23505" ? duplicate : { errors: { form: "Không thể lưu. Vui lòng thử lại." } };
    done();
    return { id: data.id };
  }

  let update = admin.from("vouchers").update(fields).eq("id", input.id).in("type", EDITABLE);
  // compare-and-set: an order redeeming the code between the check above and this write
  // bumps used_count, so the update matches nothing instead of re-pricing a used code.
  if (!locked) update = update.eq("used_count", 0);
  const { data, error } = await update.select("id");
  if (error) return error.code === "23505" ? duplicate : { errors: { form: "Không thể lưu. Vui lòng thử lại." } };
  if (!data.length) return { errors: { form: "Mã vừa được dùng cho một đơn hàng. Tải lại trang rồi lưu lại." } };
  done();
  return { id: input.id };
}

export async function setPromoActive(id: string, isActive: boolean): Promise<{ error?: string }> {
  await requireAdmin();
  const { data, error } = await createAdminClient().from("vouchers").update({ is_active: isActive }).eq("id", id).in("type", EDITABLE).select("id");
  if (error || !data.length) return { error: "Không thể cập nhật. Vui lòng thử lại." };
  done();
  return {};
}
