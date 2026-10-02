import Link from "next/link";

// Replaces Next's English 404 (UI is Vietnamese-only, CLAUDE.md §5).
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-page-title uppercase">Không tìm thấy trang</h1>
      <p className="text-text-secondary">Trang này không tồn tại hoặc chưa được xây dựng.</p>
      <Link href="/" className="text-label uppercase underline underline-offset-4 hover:text-accent">
        Về trang tổng quan
      </Link>
    </div>
  );
}
