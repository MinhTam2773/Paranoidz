"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@paranoidz/db/server";
import { PHONE_TAKEN } from "@/lib/auth";
import { normalizePhone, validateField, type FieldErrors } from "@/lib/checkout-validation";

// Account: address book + edit profile. Runs AS the signed-in user (server client): RLS still
// decides what they can touch; running here means the checkout field rules are enforced, not just suggested.
export type AddressFields = { name: string; phone: string; address: string; ward: string; city: string };
export type ActionResult = { ok: true } | { ok: false; message?: string; fieldErrors?: FieldErrors };

const FIELDS = ["name", "phone", "address", "ward", "city"] as const;
const MAX_ADDRESSES = 10;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXPIRED: ActionResult = { ok: false, message: "Your session has expired. Log in again." };
const FAILED: ActionResult = { ok: false, message: "Couldn't save that. Try again." };

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data ? { supabase, userId: data.claims.sub } : null;
}

export async function saveAddress(input: { id?: string } & AddressFields): Promise<ActionResult> {
  const s = await session();
  if (!s) return EXPIRED;
  const v = Object.fromEntries(FIELDS.map((k) => [k, typeof input?.[k] === "string" ? input[k].trim() : ""])) as AddressFields;
  const fieldErrors: FieldErrors = {};
  for (const k of FIELDS) {
    const e = validateField(k, v[k], v);
    if (e) fieldErrors[k] = e;
  }
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };

  const row = { name: v.name, phone: normalizePhone(v.phone)!, address: v.address, ward: v.ward, city: v.city };
  if (input.id) {
    if (!UUID.test(input.id)) return FAILED;
    const { data, error } = await s.supabase.from("addresses").update(row).eq("id", input.id).eq("user_id", s.userId).select("id");
    if (error || !data.length) return FAILED;
  } else {
    const { count } = await s.supabase.from("addresses").select("id", { count: "exact", head: true }).eq("user_id", s.userId);
    if ((count ?? 0) >= MAX_ADDRESSES) return { ok: false, message: `You can save up to ${MAX_ADDRESSES} addresses. Delete one first.` };
    // The first address becomes the default, so checkout always has one to pre-fill.
    const { error } = await s.supabase.from("addresses").insert({ ...row, user_id: s.userId, is_default: !count });
    if (error) return FAILED;
  }
  revalidatePath("/account");
  return { ok: true };
}

export async function deleteAddress(id: string): Promise<ActionResult> {
  const s = await session();
  if (!s) return EXPIRED;
  if (!UUID.test(id)) return FAILED;
  // Past orders keep their snapshot; orders.address_id is set null by the FK.
  const { error } = await s.supabase.from("addresses").delete().eq("id", id).eq("user_id", s.userId);
  if (error) return FAILED;
  revalidatePath("/account");
  return { ok: true };
}

export async function setDefaultAddress(id: string): Promise<ActionResult> {
  const s = await session();
  if (!s) return EXPIRED;
  if (!UUID.test(id)) return FAILED;
  const { data: target } = await s.supabase.from("addresses").select("id").eq("id", id).eq("user_id", s.userId).maybeSingle();
  if (!target) return FAILED;
  // Two statements: clear the old default first (addresses_one_default_per_user allows one).
  const { error: clearError } = await s.supabase.from("addresses").update({ is_default: false }).eq("user_id", s.userId).eq("is_default", true);
  if (clearError) return FAILED;
  const { error } = await s.supabase.from("addresses").update({ is_default: true }).eq("id", id).eq("user_id", s.userId);
  if (error) return FAILED;
  revalidatePath("/account");
  return { ok: true };
}

// Edit profile: name + phone only (the column grant allows nothing else). profiles.phone is
// convenience (checkout pre-fill); every per-customer rule keys on orders.phone, so changing it
// moves no discounts or history.
export async function updateProfile(input: { name: string; phone: string }): Promise<ActionResult> {
  const s = await session();
  if (!s) return EXPIRED;
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  const phone = typeof input?.phone === "string" ? input.phone.trim() : "";
  const fieldErrors: FieldErrors = {};
  const nameError = name ? validateField("name", name) : "Enter your full name.";
  const phoneError = phone ? validateField("phone", phone) : "Enter your phone number.";
  if (nameError) fieldErrors.name = nameError;
  if (phoneError) fieldErrors.phone = phoneError;
  if (nameError || phoneError) return { ok: false, fieldErrors };

  const { error } = await s.supabase.from("profiles").update({ full_name: name, phone: normalizePhone(phone)! }).eq("id", s.userId);
  if (error?.code === "23505") return { ok: false, fieldErrors: { phone: PHONE_TAKEN } };
  if (error) return FAILED;
  revalidatePath("/account");
  return { ok: true };
}
