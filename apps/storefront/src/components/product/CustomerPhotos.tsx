"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { CloseIcon } from "@/components/layout/icons";
import { Stars } from "./ReviewSection";
import type { CustomerReview } from "./customer-photos-data";

// Read-only block of customer reviews, rendered at the top of the reviews
// tab. Deliberately separate from ReviewSection (web reviews): each entry
// shows only its own stars, author, date and words plus its
// photos — no aggregate rating, no marketplace attribution.
export function CustomerPhotos({ reviews }: { reviews: CustomerReview[] }) {
  if (!reviews.length) return null;
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-nav font-bold uppercase">Đánh giá của khách hàng</h2>
      <ul className="flex flex-col divide-y divide-border border-t border-border">
        {reviews.map((r, i) => (
          <li key={`${r.author}-${r.date}-${i}`} className="flex flex-col gap-2 py-6">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Stars rating={r.rating} />
              <span className="text-product-name">{r.author}</span>
              <span className="text-caption text-text-muted">{r.date}</span>
            </div>
            <p className="whitespace-pre-line text-text-secondary">{r.content}</p>
            <ReviewPhotos photos={r.photos} />
          </li>
        ))}
      </ul>
    </div>
  );
}

// Thumbnails; a click opens the photo large in a native <dialog> (Esc, backdrop or × closes it).
function ReviewPhotos({ photos }: { photos: string[] }) {
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
