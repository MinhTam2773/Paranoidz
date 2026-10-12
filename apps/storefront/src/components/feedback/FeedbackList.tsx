"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { secondaryClass } from "@/components/auth/styles";
import { Stars } from "@/components/product/ReviewSection";
import { placedOn } from "@/lib/order-status";

export type FeedbackReview = {
  id: string;
  rating: number;
  content: string;
  authorName: string;
  createdAt: string;
  product: { name: string; slug: string } | null;
  photoUrl: string | null;
};

const PAGE = 9;
const TABS = [
  { id: "recent", label: "Mới nhất" },
  { id: "top", label: "Đánh giá cao" },
  { id: "photos", label: "Có hình ảnh" },
] as const;
type Tab = (typeof TABS)[number]["id"];

// Reviews arrive newest first; the sort is stable, so "top" stays newest first within a rating.
function pick(reviews: FeedbackReview[], tab: Tab) {
  if (tab === "top") return reviews.toSorted((a, b) => b.rating - a.rating);
  if (tab === "photos") return reviews.filter((r) => r.photoUrl);
  return reviews;
}

// Stitch "Customer Feedback": tab pills (DESIGN.md §4 tab switcher), 3-column cards, load more.
// Every review is from a customer with a delivered order (reviews RLS), hence "Đã mua hàng".
export function FeedbackList({ reviews }: { reviews: FeedbackReview[] }) {
  const [tab, setTab] = useState<Tab>("recent");
  const [shown, setShown] = useState(PAGE);
  const list = pick(reviews, tab);

  return (
    <section>
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={t.id === tab}
            onClick={() => {
              setTab(t.id);
              setShown(PAGE);
            }}
            className={`h-11 rounded-sm px-6 text-nav font-bold uppercase transition-colors duration-200 ${
              t.id === tab ? "bg-text-primary text-text-on-dark" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {list.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.slice(0, shown).map((r) => (
            <li key={r.id} className="flex flex-col gap-3 rounded-sm border border-border p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <p className="text-product-name font-semibold uppercase">{r.authorName}</p>
                  <p className="text-caption font-semibold uppercase text-text-secondary">
                    <span aria-hidden className="text-success">✓</span> Đã mua hàng
                  </p>
                </div>
                <Stars rating={r.rating} />
              </div>
              {r.photoUrl && (
                <div className="relative aspect-4/3 overflow-hidden rounded-sm bg-bg-secondary">
                  <Image
                    src={r.photoUrl}
                    alt={`Ảnh đánh giá của ${r.authorName}`}
                    fill
                    sizes="(min-width: 1280px) 400px, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                </div>
              )}
              <p className="whitespace-pre-line text-body">{r.content}</p>
              <div className="mt-auto flex flex-wrap justify-between gap-2 border-t border-border pt-3 text-caption uppercase text-text-muted">
                <span>{placedOn.format(new Date(r.createdAt))}</span>
                {r.product && (
                  <Link href={`/products/${r.product.slug}`} className="text-text-secondary hover:text-text-primary">
                    {r.product.name}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-text-secondary">Chưa có đánh giá kèm hình ảnh.</p>
      )}

      {shown < list.length && (
        <button type="button" onClick={() => setShown((n) => n + PAGE)} className={`${secondaryClass} mx-auto mt-8 max-w-xs`}>
          Xem thêm đánh giá
        </button>
      )}
    </section>
  );
}
