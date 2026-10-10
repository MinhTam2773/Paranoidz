import Image from "next/image";
import Link from "next/link";
import { createAdminClient } from "@paranoidz/db/admin";
import { ActiveToggle } from "@/components/ActiveToggle";
import { ReviewsIcon } from "@/components/icons";
import { Pagination } from "@/components/Pagination";
import { BrandReplyForm } from "@/components/reviews/BrandReplyForm";
import { ReviewDrawer } from "@/components/reviews/ReviewDrawer";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, formatPhone } from "@/lib/format";
import { setReplyVisible, setReviewImageVisible, setReviewVisible } from "./actions";

const PAGE_SIZE = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function href(page: number, review?: string) {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (review) params.set("review", review);
  const s = params.toString();
  return s ? `/reviews?${s}` : "/reviews";
}

// DASHBOARD_DESIGN.md §6.9: list + detail drawer (?review=<id>). Hide/show is the only moderation.
export default async function ReviewsPage({ searchParams }: PageProps<"/reviews">) {
  await requireAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const reviewId = typeof sp.review === "string" && UUID.test(sp.review) ? sp.review : "";
  const admin = createAdminClient();

  const { data: reviews, count, error } = await admin
    .from("reviews")
    .select("id, rating, content, author_name, is_visible, created_at, products(name), review_images(count), review_replies(count)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (error) throw error;
  const pages = Math.ceil((count ?? 0) / PAGE_SIZE);
  // e.g. "2 ảnh · 1 phản hồi"; empty when there are neither.
  const counts = (r: (typeof reviews)[number]) => {
    const photos = r.review_images[0]?.count ?? 0;
    const replies = r.review_replies[0]?.count ?? 0;
    return [photos > 0 && `${photos} ảnh`, replies > 0 && `${replies} phản hồi`].filter(Boolean).join(" · ");
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-text-secondary">Đánh giá hiện ngay khi khách gửi. Ẩn một đánh giá cũng ẩn ảnh và phản hồi của nó. Cửa hàng cập nhật trong khoảng 1 phút.</p>

      {reviews.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-sm border border-border bg-surface px-6 py-16 text-center text-text-secondary">
          <ReviewsIcon width={32} height={32} className="text-text-muted" />
          <p>Chưa có đánh giá nào.</p>
        </div>
      ) : (
        <>
          {/* ≥768px: table; the content link is stretched over the row and opens the drawer. */}
          <table className="hidden w-full table-fixed overflow-hidden rounded-sm border border-border bg-surface md:table">
            <thead className="bg-bg-secondary text-left">
              <tr className="text-th uppercase text-text-secondary">
                <th scope="col" className="w-[20%] px-4 py-3">Sản phẩm</th>
                <th scope="col" className="w-[14%] px-4 py-3">Khách hàng</th>
                <th scope="col" className="w-[13%] px-4 py-3">Số sao</th>
                <th scope="col" className="px-4 py-3">Nội dung</th>
                <th scope="col" className="w-[11%] px-4 py-3">Hiển thị</th>
                <th scope="col" className="w-[13%] px-4 py-3">Ngày</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((r) => (
                <tr key={r.id} className={`relative h-14 border-t border-border hover:bg-bg-secondary ${r.is_visible ? "" : "text-text-secondary"}`}>
                  <td className="truncate px-4 font-semibold">{r.products.name}</td>
                  <td className="truncate px-4">{r.author_name}</td>
                  <td className="px-4"><Stars rating={r.rating} /></td>
                  <td className="px-4 py-2">
                    <Link href={href(page, r.id)} scroll={false} className="line-clamp-2 wrap-break-word after:absolute after:inset-0">{r.content}</Link>
                    {counts(r) && <span className="text-stat-label text-text-secondary">{counts(r)}</span>}
                  </td>
                  <td className="px-4"><ActiveToggle name={`Đánh giá của ${r.author_name}`} active={r.is_visible} label="Đang hiện" setActive={setReviewVisible.bind(null, r.id)} /></td>
                  <td className="px-4 text-stat-label text-text-secondary">{formatDateTime(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* <768px: stacked cards (§4 mobile). */}
          <ul className="flex flex-col gap-2 md:hidden">
            {reviews.map((r) => (
              <li key={r.id} className={`relative flex gap-3 rounded-sm border border-border bg-surface p-3 ${r.is_visible ? "" : "text-text-secondary"}`}>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-semibold wrap-break-word">{r.products.name}</span>
                  <span className="flex flex-wrap items-center gap-2"><Stars rating={r.rating} /><span className="text-text-secondary">{r.author_name}</span></span>
                  <Link href={href(page, r.id)} scroll={false} className="line-clamp-2 wrap-break-word after:absolute after:inset-0">{r.content}</Link>
                  <span className="text-stat-label text-text-secondary">
                    {formatDateTime(r.created_at)}{counts(r) && ` · ${counts(r)}`}
                  </span>
                </div>
                <ActiveToggle name={`Đánh giá của ${r.author_name}`} active={r.is_visible} label="Đang hiện" setActive={setReviewVisible.bind(null, r.id)} />
              </li>
            ))}
          </ul>
        </>
      )}

      <Pagination page={page} pages={pages} href={(p) => href(p)} />

      {reviewId && <ReviewDetail key={reviewId} id={reviewId} closeHref={href(page)} />}
    </div>
  );
}

async function ReviewDetail({ id, closeHref }: { id: string; closeHref: string }) {
  const admin = createAdminClient();
  const { data: review, error } = await admin
    .from("reviews")
    .select("id, rating, content, author_name, is_visible, created_at, products(id, name), profiles(full_name, phone), review_images(id, storage_path, sort_order, is_visible), review_replies(id, content, author_name, is_brand_reply, is_visible, created_at)")
    .eq("id", id)
    .order("sort_order", { referencedTable: "review_images" })
    .order("created_at", { referencedTable: "review_replies" })
    .maybeSingle();
  if (error) throw error;
  if (!review) {
    return (
      <ReviewDrawer closeHref={closeHref}>
        <p className="text-text-secondary">Không tìm thấy đánh giá này.</p>
      </ReviewDrawer>
    );
  }

  // Link the phone to the customer page only when that phone has ordered (customers row).
  const phone = review.profiles.phone;
  const { data: customer } = phone
    ? await admin.from("customers").select("phone").eq("phone", phone).maybeSingle()
    : { data: null };
  const photos = admin.storage.from("review-images");

  return (
    <ReviewDrawer closeHref={closeHref}>
      <section className="flex flex-col gap-3">
        <Link href={`/products/${review.products.id}`} className="font-semibold wrap-break-word hover:underline">{review.products.name}</Link>
        <div className="flex flex-col gap-1 text-text-secondary">
          <span className="text-text-primary">{review.profiles.full_name || review.author_name} <span className="text-text-secondary">· hiển thị là “{review.author_name}”</span></span>
          {phone && (customer ? <Link href={`/customers/${phone}`} className="w-fit hover:text-text-primary hover:underline">{formatPhone(phone)}</Link> : <span>{formatPhone(phone)}</span>)}
          <span className="text-stat-label">{formatDateTime(review.created_at)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <Stars rating={review.rating} />
          <span className="flex items-center gap-2 text-label uppercase text-text-secondary">
            {review.is_visible ? "Đang hiện" : "Đã ẩn"}
            <ActiveToggle name="Đánh giá" active={review.is_visible} label="Đang hiện" setActive={setReviewVisible.bind(null, review.id)} />
          </span>
        </div>
        <p className="whitespace-pre-line wrap-break-word">{review.content}</p>
      </section>

      {review.review_images.length > 0 && (
        <section className="flex flex-col gap-3 border-t border-border pt-5">
          <h3 className="text-card-title uppercase">Ảnh ({review.review_images.length})</h3>
          {!review.is_visible && (
            <p className="text-stat-label text-text-secondary">Đánh giá đang ẩn nên các ảnh cũng không hiện trên cửa hàng.</p>
          )}
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {review.review_images.map((img, i) => {
              const url = photos.getPublicUrl(img.storage_path).data.publicUrl;
              return (
                <li key={img.id} className="flex flex-col">
                  <a href={url} target="_blank" rel="noreferrer" className="relative aspect-square overflow-hidden rounded-sm bg-bg-tertiary">
                    <Image src={url} alt={`Ảnh ${i + 1} (mở trong tab mới)`} fill sizes="(min-width: 640px) 104px, 50vw" className={`object-cover ${img.is_visible ? "" : "opacity-50"}`} />
                  </a>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-stat-label text-text-secondary">{!img.is_visible && "đã ẩn"}</span>
                    <ActiveToggle name={`Ảnh ${i + 1}`} active={img.is_visible} label="Đang hiện" setActive={setReviewImageVisible.bind(null, img.id)} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3 border-t border-border pt-5">
        <h3 className="text-card-title uppercase">Phản hồi ({review.review_replies.length})</h3>
        {!review.is_visible && review.review_replies.length > 0 && (
          <p className="text-stat-label text-text-secondary">Đánh giá đang ẩn nên các phản hồi cũng không hiện trên cửa hàng.</p>
        )}
        {review.review_replies.length > 0 && (
          <ul className="flex flex-col gap-3">
            {review.review_replies.map((p) => (
              <li key={p.id} className={`flex flex-col gap-1 rounded-sm p-3 ${p.is_brand_reply ? "border border-text-primary" : "bg-bg-secondary"} ${p.is_visible ? "" : "text-text-secondary"}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 wrap-break-word">
                    <span className="font-semibold">{p.author_name}</span>
                    <span className="text-stat-label text-text-secondary"> · {formatDateTime(p.created_at)}{!p.is_visible && " · đã ẩn"}</span>
                  </span>
                  <ActiveToggle name={`Phản hồi của ${p.author_name}`} active={p.is_visible} label="Đang hiện" setActive={setReplyVisible.bind(null, p.id)} />
                </div>
                <p className="whitespace-pre-line wrap-break-word">{p.content}</p>
              </li>
            ))}
          </ul>
        )}
        <BrandReplyForm reviewId={review.id} />
      </section>
    </ReviewDrawer>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span role="img" aria-label={`${rating}/5 sao`} className="whitespace-nowrap tracking-[0.1em]">
      <span className="text-text-primary">{"★".repeat(rating)}</span>
      <span className="text-border-hover">{"★".repeat(5 - rating)}</span>
    </span>
  );
}
