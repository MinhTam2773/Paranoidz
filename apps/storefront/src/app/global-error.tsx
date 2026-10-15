"use client";

import "./globals.css";

// Only when the root layout itself fails: replaces it, so it brings its own <html> (CLAUDE.md §5: Vietnamese, lang="vi").
export default function GlobalError({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <html lang="vi">
      <body className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
        <title>Đã có lỗi xảy ra | Paranoidz</title>
        <h1 className="text-h2 uppercase">Đã có lỗi xảy ra</h1>
        <p className="text-text-secondary">Trang này chưa tải được. Bạn thử lại sau ít phút nhé.</p>
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="flex h-12 w-full max-w-xs items-center justify-center rounded-sm bg-accent text-button uppercase text-text-on-dark transition-all duration-200 hover:-translate-y-px hover:bg-accent-hover hover:shadow-accent"
        >
          Thử lại
        </button>
      </body>
    </html>
  );
}
