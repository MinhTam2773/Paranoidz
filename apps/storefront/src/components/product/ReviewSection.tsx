"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { createClient } from "@paranoidz/db/client";
import {
  addReply,
  addReviewImage,
  createReviewImageUpload,
  deleteReply,
  deleteReview,
  deleteReviewImage,
  getReviewViewer,
  saveReview,
  type ReviewPhoto,
  type ReviewResult,
  type ReviewViewer,
} from "@/app/products/[slug]/review-actions";
import { openLogin } from "@/components/auth/LoginModal";
import { errorClass, primaryClass } from "@/components/auth/styles";
import { CloseIcon } from "@/components/layout/icons";
import { placedOn } from "@/lib/order-status";
import { MAX_REPLY, MAX_REVIEW, MAX_REVIEW_IMAGE_BYTES, MAX_REVIEW_IMAGES, REVIEW_IMAGE_TYPES } from "@/lib/reviews";

export type ReviewReply = { id: string; userId: string; content: string; authorName: string; isBrand: boolean; createdAt: string };
export type ReviewData = {
  id: string;
  userId: string;
  rating: number;
  content: string;
  authorName: string;
  createdAt: string;
  photos: { id: string; url: string }[];
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

export function Stars({ rating }: { rating: number }) {
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

// Signed URL from the server → bytes straight to Storage → register the row.
async function uploadPhoto(productId: string, slug: string, file: File): Promise<ReviewResult> {
  const ticket = await createReviewImageUpload(productId, file.type, file.size);
  if (!ticket.ok) return ticket;
  const { error } = await createClient()
    .storage.from("review-images")
    .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type });
  if (error) return { ok: false, message: "Tải lên thất bại." };
  return addReviewImage(productId, slug, ticket.path);
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
  const [photoError, setPhotoError] = useState<string | null>(null);
  const { pending, error, run } = useAction(async () => {
    setEditing(false);
    await onChanged();
  });
  // Removing a saved photo keeps the form open.
  const removal = useAction(onChanged);

  // A new review must exist before its photos: save it, then upload each new file. Photos that
  // fail are reported under the saved review; the ones that made it stay.
  function submit(rating: number, content: string, files: File[]) {
    setPhotoError(null);
    run(async () => {
      const saved = await saveReview({ productId, slug, rating, content });
      if (!saved.ok) return saved;
      const failed: string[] = [];
      for (const file of files) {
        const added = await uploadPhoto(productId, slug, file);
        if (!added.ok) failed.push(`${file.name}: ${added.message}`);
      }
      if (failed.length) setPhotoError(`Đã lưu đánh giá, nhưng ${failed.length}/${files.length} ảnh chưa tải lên được. ${failed.join(" ")}`);
      return saved;
    });
  }

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
        pending={pending || removal.pending}
        error={error ?? removal.error}
        onCancel={own ? () => setEditing(false) : undefined}
        onSubmit={submit}
        onRemovePhoto={(id) => {
          if (confirm("Xóa ảnh này khỏi đánh giá?")) removal.run(() => deleteReviewImage(id, slug));
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-sm border border-border p-4 lg:p-6">
      <h3 className="text-nav font-bold uppercase">Đánh giá của bạn</h3>
      {!own.isVisible && <p className="text-caption text-accent">Đánh giá này đang bị cửa hàng ẩn khỏi trang sản phẩm.</p>}
      <Stars rating={own.rating} />
      <p className="whitespace-pre-line text-text-secondary">{own.content}</p>
      <ReviewPhotos photos={own.photos} />
      {own.photos.some((p) => !p.isVisible) && (
        <p className="text-caption text-accent">Ảnh có nhãn “Đã ẩn” đang bị cửa hàng ẩn khỏi trang sản phẩm.</p>
      )}
      <div className="flex gap-6">
        <button
          type="button"
          onClick={() => {
            setPhotoError(null);
            setEditing(true);
          }}
          disabled={pending}
          className={textButtonClass}
        >
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
      {photoError && <p className={errorClass}>{photoError}</p>}
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
  onRemovePhoto,
}: {
  initial: { rating: number; content: string; photos: ReviewPhoto[] } | null;
  pending: boolean;
  error: string | null;
  onSubmit: (rating: number, content: string, files: File[]) => void;
  onCancel?: () => void;
  onRemovePhoto: (id: string) => void;
}) {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [content, setContent] = useState(initial?.content ?? "");
  const [missingRating, setMissingRating] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const photos = initial?.photos ?? [];
  const room = MAX_REVIEW_IMAGES - photos.length - files.length;

  // Clear messages up front; the bucket (type, 5 MB) and the trigger (4 per review) enforce the same.
  function pick(list: File[]) {
    const errors: string[] = [];
    const valid = list.filter((f) => {
      if (!Object.hasOwn(REVIEW_IMAGE_TYPES, f.type)) errors.push(`${f.name}: chỉ nhận ảnh JPG, PNG hoặc WebP.`);
      else if (f.size > MAX_REVIEW_IMAGE_BYTES) errors.push(`${f.name}: ảnh tối đa 5 MB.`);
      else return true;
      return false;
    });
    if (valid.length > room) errors.push(`Tối đa ${MAX_REVIEW_IMAGES} ảnh mỗi đánh giá.`);
    setFiles([...files, ...valid.slice(0, Math.max(room, 0))]);
    setFileError(errors.join(" ") || null);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!rating) return setMissingRating(true);
        onSubmit(rating, content, files);
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
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <Thumb key={p.id} hidden={!p.isVisible} removeLabel={`Xóa ảnh ${i + 1}`} disabled={pending} onRemove={() => onRemovePhoto(p.id)}>
              <Image src={p.url} alt={`Ảnh ${i + 1}`} fill sizes="80px" className="object-cover" />
            </Thumb>
          ))}
          {files.map((f, i) => (
            <Thumb
              key={i}
              removeLabel={`Bỏ ảnh ${f.name}`}
              disabled={pending}
              onRemove={() => setFiles(files.filter((_, j) => j !== i))}
            >
              <FilePreview file={f} />
            </Thumb>
          ))}
          {room > 0 && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={pending}
              className="flex size-20 flex-col items-center justify-center gap-1 rounded-sm border border-dashed border-border text-caption text-text-secondary hover:border-text-primary hover:text-text-primary disabled:opacity-50"
            >
              <span aria-hidden className="text-h3">+</span>
              Thêm ảnh
            </button>
          )}
        </div>
        <p className="text-caption text-text-muted">Tối đa {MAX_REVIEW_IMAGES} ảnh · JPG, PNG, WebP · mỗi ảnh tối đa 5 MB</p>
        {fileError && <p className={errorClass}>{fileError}</p>}
        <input
          ref={fileRef}
          type="file"
          accept={Object.keys(REVIEW_IMAGE_TYPES).join(",")}
          multiple
          hidden
          onChange={(e) => {
            pick([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
      </div>
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
      <ReviewPhotos photos={review.photos} />

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

// Marks a photo the shop hid; only its author ever sees it.
function HiddenTag() {
  return (
    <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-bg-primary/90 py-0.5 text-center text-caption text-accent">Đã ẩn</span>
  );
}

// Thumbnails; a click opens the photo large in a native <dialog> (Esc, backdrop or × closes it).
function ReviewPhotos({ photos }: { photos: { id: string; url: string; isVisible?: boolean }[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Opened from the click itself: reopening the same photo sets the same state, which re-renders nothing.
  const show = (url: string) => {
    setOpen(url);
    dialogRef.current?.showModal();
  };

  if (!photos.length) return null;
  return (
    <>
      <ul className="flex flex-wrap gap-2">
        {photos.map((p, i) => (
          <li key={p.id} className="relative size-20 overflow-hidden rounded-sm bg-bg-tertiary">
            <button type="button" onClick={() => show(p.url)} aria-label={`Xem ảnh ${i + 1}`} className="block size-full">
              <Image src={p.url} alt="" fill sizes="80px" className="object-cover" />
            </button>
            {p.isVisible === false && <HiddenTag />}
          </li>
        ))}
      </ul>
      <dialog
        ref={dialogRef}
        onClose={() => setOpen(null)}
        // a click anywhere (photo, letterbox, × or backdrop) closes it
        onClick={(e) => e.currentTarget.close()}
        aria-label="Ảnh đánh giá"
        className="m-auto h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-h-none max-w-none bg-transparent p-0 backdrop:bg-bg-dark/80"
      >
        {open && (
          <>
            {/* fills the screen minus 16px, photo scaled to fit whatever its shape */}
            <Image src={open} alt="Ảnh đánh giá" fill sizes="100vw" className="object-contain" />
            <button
              type="button"
              aria-label="Đóng"
              className="absolute right-0 top-0 flex size-11 items-center justify-center rounded-sm bg-bg-primary/90"
            >
              <CloseIcon />
            </button>
          </>
        )}
      </dialog>
    </>
  );
}

// 80px square in the review form, with a remove button in its corner.
function Thumb({
  children,
  hidden,
  removeLabel,
  disabled,
  onRemove,
}: {
  children: ReactNode;
  hidden?: boolean;
  removeLabel: string;
  disabled: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="relative size-20 overflow-hidden rounded-sm bg-bg-tertiary">
      {children}
      {hidden && <HiddenTag />}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={removeLabel}
        className="absolute right-0 top-0 flex size-11 items-start justify-end p-1 disabled:opacity-50"
      >
        <span className="flex size-6 items-center justify-center rounded-sm bg-bg-primary/90 shadow-1">
          <CloseIcon width={14} height={14} />
        </span>
      </button>
    </div>
  );
}

// Local preview of a picked file; its object URL is released when the file leaves the list.
function FilePreview({ file }: { file: File }) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    if (ref.current) ref.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  // eslint-disable-next-line @next/next/no-img-element -- blob: URL, nothing for next/image to optimize
  return <img ref={ref} alt={file.name} className="size-full object-cover" />;
}
