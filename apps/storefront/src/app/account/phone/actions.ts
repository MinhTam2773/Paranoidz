"use server";

import { redirect } from "next/navigation";
import { createClient } from "@paranoidz/db/server";
import { safeNext } from "@/lib/auth";
import { normalizePhone } from "@/lib/checkout-validation";
import { HOTLINE } from "@/lib/site";

// Acts as the signed-in user: RLS + the column grant only let them set their own phone, and
// profiles_phone_normalized / profiles_phone_unique have the final say.
export async function savePhone(input: { phone: string; next: string }): Promise<{ error: string }> {
  const phone = normalizePhone(input.phone);
  if (!phone) return { error: "Enter a Vietnamese mobile number: 10 digits starting with 03, 05, 07, 08 or 09." };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims) redirect("/login");

  const { error } = await supabase.from("profiles").update({ phone }).eq("id", claims.claims.sub);
  if (error?.code === "23505") {
    return { error: `This number is already on another Paranoidz account. Log in with that account, or call ${HOTLINE} for help.` };
  }
  if (error) return { error: "Couldn't save your number. Try again." };
  redirect(safeNext(input.next));
}
