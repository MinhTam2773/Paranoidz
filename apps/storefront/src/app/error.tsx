"use client";

import Link from "next/link";

// Replaces Next's English error screen (UI is Vietnamese-only, CLAUDE.md §5). Rendered inside the root layout.
export default function Error({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col items-start gap-6 px-4 py-16 lg:px-6">
      <title>Đã có lỗi xảy ra | Paranoidz</title>
      <h1 className="text-h2 uppercase">Đã có lỗi xảy ra</h1>
      <p className="text-text-secondary">Trang này chưa tải được. Bạn thử lại sau ít phút nhé.</p>
      <div className="flex w-full max-w-xs flex-col gap-3">
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="flex h-12 w-full items-center justify-center rounded-sm bg-accent text-button uppercase text-text-on-dark transition-all duration-200 hover:-translate-y-px hover:bg-accent-hover hover:shadow-accent"
        >
          Thử lại
        </button>
        <Link
          href="/"
          className="flex h-12 w-full items-center justify-center rounded-sm border border-text-primary text-button uppercase text-text-primary transition-colors duration-200 hover:bg-text-primary hover:text-text-on-dark"
        >
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
