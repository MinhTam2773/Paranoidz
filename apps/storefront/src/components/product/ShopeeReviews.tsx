"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Stars } from "./ReviewSection";
import { CloseIcon } from "@/components/layout/icons";
import type { ShopeeReview } from "./shopee-reviews-data";

// Read-only block of curated Shopee reviews, rendered at the top of the reviews tab.
// It is deliberately separate from ReviewSection (web reviews): the header says where the
// reviews come from, and no aggregate rating is claimed — only each real review's own stars
// are shown.
export function ShopeeReviews({ totalRatings, reviews }: { totalRatings: number; reviews: ShopeeReview[] }) {
  if (!reviews.length) return null;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-nav font-bold uppercase">Ảnh thật từ khách trên Shopee</h2>
        <p className="text-caption text-text-secondary">
          {reviews.length} bài nổi bật trong {totalRatings} lượt đánh giá trên Shopee. Ảnh và lời nhận xét do khách đăng trên
          Shopee, shop tổng hợp lại đây — đây không phải đánh giá gửi trên web này.
        </p>
      </div>
      <ul className="flex flex-col divide-y divide-border border-t border-border">
        {reviews.map((r, i) => (
          <li key={`${r.author}-${r.date}-${i}`} className="flex flex-col gap-2 py-6">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Stars rating={r.rating} />
              <span className="text-product-name">{r.author}</span>
              <span className="text-caption text-text-muted">{r.date}</span>
            </div>
            <p className="text-caption text-text-muted">Phân loại: {r.variant}</p>
            <p className="whitespace-pre-line text-text-secondary">{r.content}</p>
            <ShopeePhotos photos={r.photos} />
          </li>
        ))}
      </ul>
      <p className="text-caption text-text-secondary">
        Xem đủ {totalRatings} lượt đánh giá trên gian hàng Shopee của shop:{" "}
        <a
          href="https://shopee.vn/paranoidz.studio"
          target="_blank"
          rel="noreferrer"
          className="text-text-primary underline underline-offset-4 hover:text-accent"
        >
          shopee.vn/paranoidz.studio
        </a>
      </p>
    </div>
  );
}

// Thumbnails; a click opens the photo large in a native <dialog> (Esc, backdrop or × closes it).
function ShopeePhotos({ photos }: { photos: string[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const show = (url: string) => {
    setOpen(url);
    dialogRef.current?.showModal();
  };

  if (!photos.length) return null;
  return (
    <>
      <ul className="flex flex-wrap gap-2">
        {photos.map((url, i) => (
          <li key={url} className="relative size-20 overflow-hidden rounded-sm bg-bg-tertiary">
            <button type="button" onClick={() => show(url)} aria-label={`Xem ảnh ${i + 1}`} className="block size-full">
              <Image src={url} alt="" fill sizes="80px" className="object-cover" />
            </button>
          </li>
        ))}
      </ul>
      <dialog
        ref={dialogRef}
        onClose={() => setOpen(null)}
        onClick={(e) => e.currentTarget.close()}
        aria-label="Ảnh đánh giá"
        className="m-auto h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-h-none max-w-none bg-transparent p-0 backdrop:bg-bg-dark/80"
      >
        {open && (
          <>
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
