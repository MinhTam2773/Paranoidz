import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Không tìm thấy trang | Paranoidz" };

// Replaces Next's English 404 (UI is Vietnamese-only, CLAUDE.md §5). Rendered inside the root layout.
export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col items-start gap-6 px-4 py-16 lg:px-6">
      <h1 className="text-h2 uppercase">Không tìm thấy trang</h1>
      <p className="text-text-secondary">Trang này không tồn tại hoặc đã bị gỡ.</p>
      <Link
        href="/products"
        className="flex h-12 w-full max-w-xs items-center justify-center rounded-sm border border-text-primary text-button uppercase text-text-primary transition-colors duration-200 hover:bg-text-primary hover:text-text-on-dark"
      >
        Xem tất cả sản phẩm
      </Link>
    </div>
  );
}
