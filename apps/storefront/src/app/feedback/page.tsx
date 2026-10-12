import type { Metadata } from "next";
import Link from "next/link";
import { createPublicClient } from "@paranoidz/db/public";
import { FeedbackList, type FeedbackReview } from "@/components/feedback/FeedbackList";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Stars } from "@/components/product/ReviewSection";

export const metadata: Metadata = { title: "Đánh giá khách hàng | Paranoidz" };

// Every visible review in the store (RLS: visible reviews and photos only). ISR like the catalog;
// the whole list is fetched and tabbed client-side (spec 2026-10-11, approach A).
export const revalidate = 60;

async function getReviews(): Promise<FeedbackReview[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("id, rating, content, author_name, created_at, products(name, slug), review_images(storage_path, sort_order)")
    .order("created_at", { ascending: false })
    .order("sort_order", { referencedTable: "review_images" });
  if (error) throw error;
  return data.map((r) => ({
    id: r.id,
    rating: r.rating,
    content: r.content,
    authorName: r.author_name,
    createdAt: r.created_at,
    // null when RLS hides the product (inactive): the card just has no product link
    product: r.products,
    photoUrl: r.review_images[0]
      ? supabase.storage.from("review-images").getPublicUrl(r.review_images[0].storage_path).data.publicUrl
      : null,
  }));
}

export default async function FeedbackPage() {
  const reviews = await getReviews();
  const average = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-6">
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Đánh giá khách hàng" }]} />
      <h1 className="mb-6 text-h2 uppercase">Đánh giá khách hàng</h1>
      {reviews.length ? (
        <>
          <div className="mb-8 grid grid-cols-2 divide-x divide-border border-y border-border py-6 text-center">
            <div className="flex flex-col items-center gap-2 px-2">
              <Stars rating={Math.round(average)} />
              <p className="text-h3 uppercase">{average.toFixed(1).replace(".", ",")}/5 điểm trung bình</p>
            </div>
            <div className="flex flex-col items-center justify-center gap-1 px-2">
              <p className="text-h3 uppercase">{reviews.length} đánh giá</p>
              <p className="text-caption uppercase text-text-secondary">Từ khách đã mua hàng</p>
            </div>
          </div>
          <FeedbackList reviews={reviews} />
        </>
      ) : (
        <p className="text-text-secondary">
          Chưa có đánh giá nào.{" "}
          <Link href="/products" className="text-text-primary underline underline-offset-4 hover:text-accent">
            Xem sản phẩm
          </Link>
        </p>
      )}
    </div>
  );
}
