"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@paranoidz/db/server";
import { MAX_REPLY, MAX_REVIEW } from "@/lib/reviews";

// Reviews + customer replies (migration 20261008000003). Runs AS the signed-in user: RLS and column
// grants enforce who may review (delivered buyers), the author name and the brand flag; these
// actions validate input and refresh the ISR product page so the change shows at once.
export type ReviewResult = { ok: true } | { ok: false; message: string };
export type ReviewViewer = {
  userId: string;
  canReview: boolean;
  own: { rating: number; content: string; isVisible: boolean } | null;
} | null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9-]+$/;
const EXPIRED: ReviewResult = { ok: false, message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." };
const FAILED_MESSAGE = "Không thể lưu. Vui lòng thử lại.";
const FAILED: ReviewResult = { ok: false, message: FAILED_MESSAGE };
const NOT_BUYER = "Chỉ khách hàng đã nhận sản phẩm này mới có thể đánh giá.";

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data ? { supabase, userId: data.claims.sub } : null;
}

function done(slug: string): ReviewResult {
  if (SLUG.test(slug)) revalidatePath(`/products/${slug}`);
  return { ok: true };
}

/** The signed-in viewer's own review and whether they may write one; null for guests. */
export async function getReviewViewer(productId: string): Promise<ReviewViewer> {
  const s = await session();
  if (!s || !UUID.test(productId)) return null;
  const [own, can] = await Promise.all([
    s.supabase.from("reviews").select("rating, content, is_visible").eq("user_id", s.userId).eq("product_id", productId).maybeSingle(),
    s.supabase.rpc("has_delivered_product", { p_product_id: productId }),
  ]);
  return {
    userId: s.userId,
    canReview: can.data === true,
    own: own.data ? { rating: own.data.rating, content: own.data.content, isVisible: own.data.is_visible } : null,
  };
}

export async function saveReview(input: { productId: string; slug: string; rating: number; content: string }): Promise<ReviewResult> {
  const content = typeof input?.content === "string" ? input.content.trim() : "";
  if (!UUID.test(input?.productId ?? "") || !Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) return FAILED;
  if (!content) return { ok: false, message: "Vui lòng viết vài dòng về sản phẩm." };
  if (content.length > MAX_REVIEW) return { ok: false, message: `Tối đa ${MAX_REVIEW} ký tự.` };
  const s = await session();
  if (!s) return EXPIRED;

  const row = { rating: input.rating, content };
  const { data: updated, error } = await s.supabase
    .from("reviews").update(row).eq("user_id", s.userId).eq("product_id", input.productId).select("id");
  if (error) return FAILED;
  if (!updated.length) {
    const { error: insertError } = await s.supabase
      .from("reviews").insert({ ...row, product_id: input.productId, user_id: s.userId });
    if (insertError) return { ok: false, message: insertError.code === "42501" ? NOT_BUYER : FAILED_MESSAGE };
  }
  return done(input.slug);
}

export async function deleteReview(productId: string, slug: string): Promise<ReviewResult> {
  if (!UUID.test(productId)) return FAILED;
  const s = await session();
  if (!s) return EXPIRED;
  const { error } = await s.supabase.from("reviews").delete().eq("user_id", s.userId).eq("product_id", productId);
  return error ? FAILED : done(slug);
}

export async function addReply(input: { reviewId: string; slug: string; content: string }): Promise<ReviewResult> {
  const content = typeof input?.content === "string" ? input.content.trim() : "";
  if (!UUID.test(input?.reviewId ?? "")) return FAILED;
  if (!content) return { ok: false, message: "Vui lòng nhập nội dung trả lời." };
  if (content.length > MAX_REPLY) return { ok: false, message: `Tối đa ${MAX_REPLY} ký tự.` };
  const s = await session();
  if (!s) return EXPIRED;
  const { error } = await s.supabase.from("review_replies").insert({ review_id: input.reviewId, user_id: s.userId, content });
  if (error) return { ok: false, message: error.code === "42501" ? "Đánh giá này không còn hiển thị." : FAILED_MESSAGE };
  return done(input.slug);
}

export async function deleteReply(replyId: string, slug: string): Promise<ReviewResult> {
  if (!UUID.test(replyId)) return FAILED;
  const s = await session();
  if (!s) return EXPIRED;
  const { error } = await s.supabase.from("review_replies").delete().eq("id", replyId).eq("user_id", s.userId);
  return error ? FAILED : done(slug);
}
