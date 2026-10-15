"use client";

import "./globals.css";

// Only when the root layout itself fails: replaces it, so it brings its own <html> (CLAUDE.md §5: Vietnamese, lang="vi").
export default function GlobalError({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <html lang="vi">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <title>Đã có lỗi xảy ra | Paranoidz</title>
        <h1 className="text-page-title uppercase">Đã có lỗi xảy ra</h1>
        <p className="text-text-secondary">Trang này chưa tải được. Thử lại, hoặc tải lại trang sau ít phút.</p>
        <button type="button" onClick={() => unstable_retry()} className="text-label uppercase underline underline-offset-4 hover:text-accent">
          Thử lại
        </button>
      </body>
    </html>
  );
}
