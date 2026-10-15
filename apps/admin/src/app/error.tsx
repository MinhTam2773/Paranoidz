"use client";

import Link from "next/link";

// Replaces Next's English error screen (UI is Vietnamese-only, CLAUDE.md §5).
export default function Error({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <title>Đã có lỗi xảy ra | Paranoidz</title>
      <h1 className="text-page-title uppercase">Đã có lỗi xảy ra</h1>
      <p className="text-text-secondary">Trang này chưa tải được. Thử lại, hoặc tải lại trang sau ít phút.</p>
      <button type="button" onClick={() => unstable_retry()} className="text-label uppercase underline underline-offset-4 hover:text-accent">
        Thử lại
      </button>
      <Link href="/" className="text-label uppercase underline underline-offset-4 hover:text-accent">
        Về trang tổng quan
      </Link>
    </div>
  );
}
