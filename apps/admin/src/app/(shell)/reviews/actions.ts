"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@paranoidz/db/admin";
import { requireAdmin } from "@/lib/auth";

// Reviews moderation (DASHBOARD_DESIGN.md §6.9): hide/show only, no deletes.
// The storefront's product pages pick changes up on their next ISR regeneration (≤ 60s).

const done = () => revalidatePath("/reviews");
const failed = { error: "Không thể cập nhật. Vui lòng thử lại." };

export async function setReviewVisible(id: string, isVisible: boolean): Promise<{ error?: string }> {
  await requireAdmin();
  const { data, error } = await createAdminClient().from("reviews").update({ is_visible: isVisible }).eq("id", id).select("id");
  if (error || !data.length) return failed;
  done();
  return {};
}

export async function setReplyVisible(id: string, isVisible: boolean): Promise<{ error?: string }> {
  await requireAdmin();
  const { data, error } = await createAdminClient().from("review_replies").update({ is_visible: isVisible }).eq("id", id).select("id");
  if (error || !data.length) return failed;
  done();
  return {};
}

export async function setReviewImageVisible(id: string, isVisible: boolean): Promise<{ error?: string }> {
  await requireAdmin();
  const { data, error } = await createAdminClient().from("review_images").update({ is_visible: isVisible }).eq("id", id).select("id");
  if (error || !data.length) return failed;
  done();
  return {};
}

// Signed by the admin's profile; the set_review_author() trigger names it "PARANOIDZ".
export async function addBrandReply(reviewId: string, content: string): Promise<{ error?: string }> {
  const { id: userId } = await requireAdmin();
  const text = content.trim();
  if (!text) return { error: "Nhập nội dung phản hồi." };
  if (text.length > 1000) return { error: "Tối đa 1000 ký tự." };
  const { error } = await createAdminClient()
    .from("review_replies")
    .insert({ review_id: reviewId, user_id: userId, content: text, is_brand_reply: true });
  if (error) return { error: error.code === "23503" ? "Đánh giá không còn tồn tại. Tải lại trang." : "Không thể gửi. Vui lòng thử lại." };
  done();
  return {};
}
