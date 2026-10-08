"use server";

import { redirect } from "next/navigation";
import { createClient } from "@paranoidz/db/server";
import { PHONE_TAKEN, safeNext } from "@/lib/auth";
import { normalizePhone } from "@/lib/checkout-validation";

// Acts as the signed-in user: RLS + the column grant only let them set their own phone, and
// profiles_phone_normalized / profiles_phone_unique have the final say.
export async function savePhone(input: { phone: string; next: string }): Promise<{ error: string }> {
  const phone = normalizePhone(input.phone);
  if (!phone) return { error: "Nhập số di động Việt Nam: 10 chữ số, bắt đầu bằng 03, 05, 07, 08 hoặc 09." };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims) redirect("/login");

  const { error } = await supabase.from("profiles").update({ phone }).eq("id", claims.claims.sub);
  if (error?.code === "23505") return { error: PHONE_TAKEN };
  if (error) return { error: "Không thể lưu số điện thoại. Vui lòng thử lại." };
  redirect(safeNext(input.next));
}
