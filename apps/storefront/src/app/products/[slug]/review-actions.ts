"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@paranoidz/db/admin";
import { createClient } from "@paranoidz/db/server";
import { MAX_REPLY, MAX_REVIEW, MAX_REVIEW_IMAGE_BYTES, MAX_REVIEW_IMAGES, REVIEW_IMAGE_TYPES } from "@/lib/reviews";

// Reviews + customer replies (migration 20261008000003). Runs AS the signed-in user: RLS and column
// grants enforce who may review (delivered buyers), the author name and the brand flag; these
// actions validate input and refresh the ISR product page so the change shows at once.
// Review photos (migration 20261009000001) are the exception: customers have no write grant, so
// after checking the review is the caller's, rows and Storage objects go through the service role.
export type ReviewResult = { ok: true } | { ok: false; message: string };
type Failure = Extract<ReviewResult, { ok: false }>;
export type ReviewPhoto = { id: string; url: string; isVisible: boolean };
export type ReviewViewer = {
  userId: string;
  canReview: boolean;
  own: { rating: number; content: string; isVisible: boolean; photos: ReviewPhoto[] } | null;
} | null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9-]+$/;
const EXPIRED: Failure = { ok: false, message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." };
const FAILED_MESSAGE = "Không thể lưu. Vui lòng thử lại.";
const FAILED: Failure = { ok: false, message: FAILED_MESSAGE };
const NOT_BUYER = "Chỉ khách hàng đã nhận sản phẩm này mới có thể đánh giá.";
const BUCKET = "review-images";
const PHOTO_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;
const PHOTO_LIMIT: Failure = { ok: false, message: `Tối đa ${MAX_REVIEW_IMAGES} ảnh mỗi đánh giá.` };

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data ? { supabase, userId: data.claims.sub } : null;
}

function done(slug: string): ReviewResult {
  if (SLUG.test(slug)) revalidatePath(`/products/${slug}`);
  return { ok: true };
}

async function ownReviewId(s: NonNullable<Awaited<ReturnType<typeof session>>>, productId: string) {
  const { data } = await s.supabase.from("reviews").select("id").eq("user_id", s.userId).eq("product_id", productId).maybeSingle();
  return data?.id ?? null;
}

/** The signed-in viewer's own review (with all its photos, hidden ones too) and whether they may write one; null for guests. */
export async function getReviewViewer(productId: string): Promise<ReviewViewer> {
  const s = await session();
  if (!s || !UUID.test(productId)) return null;
  const [own, can] = await Promise.all([
    s.supabase
      .from("reviews")
      .select("rating, content, is_visible, review_images(id, storage_path, is_visible)")
      .eq("user_id", s.userId)
      .eq("product_id", productId)
      .order("sort_order", { referencedTable: "review_images" })
      .maybeSingle(),
    s.supabase.rpc("has_delivered_product", { p_product_id: productId }),
  ]);
  return {
    userId: s.userId,
    canReview: can.data === true,
    own: own.data
      ? {
          rating: own.data.rating,
          content: own.data.content,
          isVisible: own.data.is_visible,
          photos: own.data.review_images.map((i) => ({
            id: i.id,
            url: s.supabase.storage.from(BUCKET).getPublicUrl(i.storage_path).data.publicUrl,
            isVisible: i.is_visible,
          })),
        }
      : null,
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
  // The rows cascade with the review; the Storage objects don't, so note their paths first.
  const { data: photos } = await s.supabase
    .from("reviews").select("review_images(storage_path)").eq("user_id", s.userId).eq("product_id", productId).maybeSingle();
  const { error } = await s.supabase.from("reviews").delete().eq("user_id", s.userId).eq("product_id", productId);
  if (error) return FAILED;
  const paths = photos?.review_images.map((i) => i.storage_path) ?? [];
  if (paths.length) await createAdminClient().storage.from(BUCKET).remove(paths);
  return done(slug);
}

/** Signed upload URL for one photo of the caller's own review (the review must be saved first). */
export async function createReviewImageUpload(
  productId: string,
  contentType: string,
  size: number,
): Promise<{ ok: true; path: string; token: string } | Failure> {
  const ext = Object.hasOwn(REVIEW_IMAGE_TYPES, contentType) ? REVIEW_IMAGE_TYPES[contentType] : null;
  if (!UUID.test(productId)) return FAILED;
  if (!ext) return { ok: false, message: "Chỉ nhận ảnh JPG, PNG hoặc WebP." };
  if (!(size > 0 && size <= MAX_REVIEW_IMAGE_BYTES)) return { ok: false, message: "Ảnh tối đa 5 MB." };
  const s = await session();
  if (!s) return EXPIRED;
  const reviewId = await ownReviewId(s, productId);
  if (!reviewId) return { ok: false, message: "Vui lòng gửi đánh giá trước khi thêm ảnh." };
  const admin = createAdminClient();
  const { count } = await admin.from("review_images").select("id", { count: "exact", head: true }).eq("review_id", reviewId);
  if ((count ?? 0) >= MAX_REVIEW_IMAGES) return PHOTO_LIMIT;
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(`${s.userId}/${reviewId}/${randomUUID()}.${ext}`);
  if (error) return { ok: false, message: "Không thể tải ảnh lên. Vui lòng thử lại." };
  return { ok: true, path: data.path, token: data.token };
}

// After the browser upload: the path must be in the caller's folder for their own review of this
// product and the object must exist. The trigger re-checks the author and the 4-photo cap.
export async function addReviewImage(productId: string, slug: string, path: string): Promise<ReviewResult> {
  if (!UUID.test(productId) || typeof path !== "string") return FAILED;
  const s = await session();
  if (!s) return EXPIRED;
  const reviewId = await ownReviewId(s, productId);
  const folder = `${s.userId}/${reviewId}/`;
  if (!reviewId || !path.startsWith(folder) || !PHOTO_FILE.test(path.slice(folder.length))) {
    return { ok: false, message: "Đường dẫn ảnh không hợp lệ." };
  }
  const admin = createAdminClient();
  const { data: exists } = await admin.storage.from(BUCKET).exists(path);
  if (!exists) return { ok: false, message: "Ảnh chưa được tải lên. Vui lòng thử lại." };

  const { data: last } = await admin
    .from("review_images").select("sort_order").eq("review_id", reviewId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { error } = await admin
    .from("review_images").insert({ review_id: reviewId, user_id: s.userId, storage_path: path, sort_order: (last?.sort_order ?? -1) + 1 });
  if (error) {
    // 23505 = this path is already registered: that row owns the object, keep it.
    if (error.code !== "23505") await admin.storage.from(BUCKET).remove([path]);
    return error.message === "REVIEW_IMAGE_LIMIT" ? PHOTO_LIMIT : FAILED;
  }
  return done(slug);
}

export async function deleteReviewImage(imageId: string, slug: string): Promise<ReviewResult> {
  if (!UUID.test(imageId)) return FAILED;
  const s = await session();
  if (!s) return EXPIRED;
  const admin = createAdminClient();
  const { data, error } = await admin.from("review_images").delete().eq("id", imageId).eq("user_id", s.userId).select("storage_path");
  if (error) return FAILED;
  if (data.length) await admin.storage.from(BUCKET).remove(data.map((i) => i.storage_path));
  return done(slug);
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
