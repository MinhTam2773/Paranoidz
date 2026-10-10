"use client";

import { useState, useTransition } from "react";
import { addBrandReply } from "@/app/(shell)/reviews/actions";
import { Toast, type ToastMessage } from "../Toast";

// "Reply as PARANOIDZ" (DASHBOARD_DESIGN.md §6.9).
export function BrandReplyForm({ reviewId }: { reviewId: string }) {
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await addBrandReply(reviewId, content);
      startTransition(() => {
        setError(res.error ?? "");
        if (!res.error) {
          setContent("");
          setToast({ ok: true, text: "Đã gửi phản hồi" });
        }
      });
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor="brand-reply" className="text-label uppercase">Phản hồi với tên PARANOIDZ</label>
      <textarea
        id="brand-reply"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        maxLength={1000}
        aria-invalid={!!error}
        aria-describedby={error ? "brand-reply-error" : undefined}
        className={`w-full rounded-sm border bg-surface px-3 py-2 text-base md:text-input focus:border-text-primary focus:shadow-[0_0_0_2px_var(--color-accent-soft)] focus:outline-none ${error ? "border-accent" : "border-border"}`}
      />
      {error && <p id="brand-reply-error" className="text-stat-label text-accent">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="h-10 self-end rounded-sm bg-accent px-4 text-button uppercase text-text-on-dark enabled:hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Đang gửi…" : "Gửi phản hồi"}
      </button>
      <Toast toast={toast} setToast={setToast} />
    </form>
  );
}
