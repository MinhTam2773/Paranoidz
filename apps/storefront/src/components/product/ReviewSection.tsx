"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { createClient } from "@paranoidz/db/client";
import {
  addReply,
  deleteReply,
  deleteReview,
  getReviewViewer,
  saveReview,
  type ReviewResult,
  type ReviewViewer,
} from "@/app/products/[slug]/review-actions";
import { openLogin } from "@/components/auth/LoginModal";
import { errorClass, primaryClass } from "@/components/auth/styles";
import { placedOn } from "@/lib/order-status";
import { MAX_REPLY, MAX_REVIEW } from "@/lib/reviews";

export type ReviewReply = { id: string; userId: string; content: string; authorName: string; isBrand: boolean; createdAt: string };
export type ReviewData = {
  id: string;
  userId: string;
  rating: number;
  content: string;
  authorName: string;
  createdAt: string;
  replies: ReviewReply[];
};

const textareaClass =
  "w-full rounded-sm border bg-bg-primary px-3 py-3 text-base text-text-primary lg:text-product-name placeholder:text-text-muted focus:border-text-primary focus:shadow-[0_0_0_2px_var(--color-accent-soft)] focus:outline-none";
const textButtonClass = "inline-flex min-h-11 items-center text-nav font-bold uppercase text-text-secondary hover:text-text-primary disabled:opacity-50";

// "Đánh giá" tab. The visible reviews come server-rendered with the ISR page; who the viewer is
// (guest / buyer / author) is fetched here, so the page stays cacheable. Every write is a server
// action that revalidates the page, then router.refresh() shows the new list.
export function ReviewSection({ productId, slug, reviews }: { productId: string; slug: string; reviews: ReviewData[] }) {
  const router = useRouter();
  const [viewer, setViewer] = useState<ReviewViewer | undefined>(undefined); // undefined = loading

  useEffect(() => {
    let current: string | null | undefined;
    const { data } = createClient().auth.onAuthStateChange((_event, session) => {
      const id = session?.user.id ?? null;
      if (id === current) return; // token refresh
      current = id;
      // Supabase calls made inside this callback can deadlock the auth client; run them after it.
      setTimeout(() => void getReviewViewer(productId).then(setViewer), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [productId]);

  async function refresh() {
    setViewer(await getReviewViewer(productId));
    router.refresh();
  }

  const average = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

  return (
    <div className="flex flex-col gap-8">
      {reviews.length > 0 ? (
        <div className="flex items-center gap-4">
          <p className="text-h1 leading-none">{average.toFixed(1).replace(".", ",")}</p>
          <div className="flex flex-col gap-1">
            <Stars rating={Math.round(average)} />
            <p className="text-caption text-text-secondary">{reviews.length} đánh giá</p>
          </div>
        </div>
      ) : (
        <p className="text-text-secondary">Chưa có đánh giá nào cho sản phẩm này.</p>
      )}

      <YourReview viewer={viewer} productId={productId} slug={slug} onChanged={refresh} />

      {reviews.length > 0 && (
        <ul className="flex flex-col divide-y divide-border border-t border-border">
          {reviews.map((r) => (
            <ReviewItem key={r.id} review={r} viewer={viewer} slug={slug} onChanged={refresh} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span role="img" aria-label={`${rating}/5 sao`} className="flex gap-0.5 text-price">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} aria-hidden className={i <= rating ? "text-text-primary" : "text-border"}>
          ★
        </span>
      ))}
    </span>
  );
}

// Runs one server action; shows its error, or calls onDone after success.
function useAction(onDone: () => void | Promise<void>) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function run(action: () => Promise<ReviewResult>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (res.ok) await onDone();
      else setError(res.message);
    });
  }
  return { pending, error, run };
}

function YourReview({
  viewer,
  productId,
  slug,
  onChanged,
}: {
  viewer: ReviewViewer | undefined;
  productId: string;
  slug: string;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const { pending, error, run } = useAction(async () => {
    setEditing(false);
    await onChanged();
  });

  if (viewer === undefined) return null;
  if (viewer === null) {
    return (
      <p className="text-text-secondary">
        Đã nhận sản phẩm này?{" "}
        <button type="button" onClick={openLogin} className="text-text-primary underline underline-offset-4 hover:text-accent">
          Đăng nhập để viết đánh giá
        </button>
      </p>
    );
  }
  const { own } = viewer;
  if (!own && !viewer.canReview) return <p className="text-text-secondary">Chỉ khách hàng đã nhận sản phẩm này mới có thể đánh giá.</p>;

  if (!own || editing) {
    return (
      <ReviewForm
        initial={own}
        pending={pending}
        error={error}
        onCancel={own ? () => setEditing(false) : undefined}
        onSubmit={(rating, content) => run(() => saveReview({ productId, slug, rating, content }))}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-sm border border-border p-4 lg:p-6">
      <h3 className="text-nav font-bold uppercase">Đánh giá của bạn</h3>
      {!own.isVisible && <p className="text-caption text-accent">Đánh giá này đang bị cửa hàng ẩn khỏi trang sản phẩm.</p>}
      <Stars rating={own.rating} />
      <p className="whitespace-pre-line text-text-secondary">{own.content}</p>
      <div className="flex gap-6">
        <button type="button" onClick={() => setEditing(true)} disabled={pending} className={textButtonClass}>
          Sửa
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirm("Xóa đánh giá của bạn? Các trả lời bên dưới cũng sẽ bị xóa.")) run(() => deleteReview(productId, slug));
          }}
          className={textButtonClass}
        >
          Xóa
        </button>
      </div>
      {error && <p className={errorClass}>{error}</p>}
    </div>
  );
}

function ReviewForm({
  initial,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  initial: { rating: number; content: string } | null;
  pending: boolean;
  error: string | null;
  onSubmit: (rating: number, content: string) => void;
  onCancel?: () => void;
}) {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [content, setContent] = useState(initial?.content ?? "");
  const [missingRating, setMissingRating] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!rating) return setMissingRating(true);
        onSubmit(rating, content);
      }}
      className="flex flex-col gap-4 rounded-sm border border-border p-4 lg:p-6"
    >
      <h3 className="text-nav font-bold uppercase">{initial ? "Sửa đánh giá" : "Viết đánh giá"}</h3>
      <div role="radiogroup" aria-label="Số sao" className="flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={i === rating}
            aria-label={`${i} sao`}
            onClick={() => {
              setRating(i);
              setMissingRating(false);
            }}
            className={`flex size-11 items-center justify-center text-h2 transition-colors duration-200 ${i <= rating ? "text-text-primary" : "text-border hover:text-border-hover"}`}
          >
            ★
          </button>
        ))}
      </div>
      {missingRating && <p className={errorClass}>Vui lòng chọn số sao.</p>}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        maxLength={MAX_REVIEW}
        aria-label="Nội dung đánh giá"
        placeholder="Chất liệu, form dáng, size có vừa không…"
        className={`${textareaClass} border-border`}
      />
      {error && <p className={errorClass}>{error}</p>}
      <div className="flex items-center gap-6">
        <button type="submit" disabled={pending} className={`${primaryClass} max-w-xs`}>
          {pending ? "Đang gửi…" : "Gửi đánh giá"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={textButtonClass}>
            Hủy
          </button>
        )}
      </div>
    </form>
  );
}

function ReviewItem({
  review,
  viewer,
  slug,
  onChanged,
}: {
  review: ReviewData;
  viewer: ReviewViewer | undefined;
  slug: string;
  onChanged: () => Promise<void>;
}) {
  const [replying, setReplying] = useState(false);
  const [content, setContent] = useState("");
  const { pending, error, run } = useAction(async () => {
    setReplying(false);
    setContent("");
    await onChanged();
  });

  return (
    <li className="flex flex-col gap-2 py-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stars rating={review.rating} />
        <span className="text-product-name">{review.authorName}</span>
        <span className="text-caption text-text-muted">{placedOn.format(new Date(review.createdAt))}</span>
      </div>
      <p className="whitespace-pre-line text-text-secondary">{review.content}</p>

      {review.replies.length > 0 && (
        <ul className="mt-2 flex flex-col gap-3 border-l-2 border-border pl-4">
          {review.replies.map((r) => (
            <li key={r.id} className={`flex flex-col gap-1 ${r.isBrand ? "rounded-sm bg-bg-secondary p-3" : ""}`}>
              <p className="flex flex-wrap items-center gap-x-2 text-caption">
                <span className="font-semibold text-text-primary">{r.authorName}</span>
                {r.isBrand && <span className="rounded-sm bg-text-primary px-1.5 py-0.5 uppercase text-text-on-dark">Phản hồi từ shop</span>}
                <span className="text-text-muted">{placedOn.format(new Date(r.createdAt))}</span>
              </p>
              <p className="whitespace-pre-line text-text-secondary">{r.content}</p>
              {viewer?.userId === r.userId && !r.isBrand && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (confirm("Xóa câu trả lời này?")) run(() => deleteReply(r.id, slug));
                  }}
                  className={`${textButtonClass} self-start`}
                >
                  Xóa
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {replying ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => addReply({ reviewId: review.id, slug, content }));
          }}
          className="mt-2 flex flex-col gap-3"
        >
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            maxLength={MAX_REPLY}
            autoFocus
            aria-label={`Trả lời ${review.authorName}`}
            className={`${textareaClass} border-border`}
          />
          <div className="flex items-center gap-6">
            <button type="submit" disabled={pending} className={`${primaryClass} max-w-48`}>
              {pending ? "Đang gửi…" : "Gửi trả lời"}
            </button>
            <button type="button" onClick={() => setReplying(false)} className={textButtonClass}>
              Hủy
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          disabled={viewer === undefined}
          onClick={() => (viewer ? setReplying(true) : openLogin())}
          className={`${textButtonClass} self-start`}
        >
          Trả lời
        </button>
      )}
      {error && <p className={errorClass}>{error}</p>}
    </li>
  );
}
