"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@paranoidz/db/admin";
import { requireAdmin } from "@/lib/auth";

// customers.is_blacklisted: place_order() refuses new orders from that phone
// (any format). Existing orders are untouched.
export async function setBlacklisted(phone: string, blacklisted: boolean): Promise<{ error?: string }> {
  await requireAdmin();
  const { data, error } = await createAdminClient()
    .from("customers").update({ is_blacklisted: blacklisted }).eq("phone", phone).select("phone");
  if (error || !data?.length) return { error: "Không thể cập nhật. Vui lòng thử lại." };
  revalidatePath("/customers", "layout");
  revalidatePath("/orders", "layout");
  return {};
}
