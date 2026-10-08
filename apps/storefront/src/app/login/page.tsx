import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { safeNext } from "@/lib/auth";

export const metadata: Metadata = { title: "Đăng nhập | Paranoidz", robots: { index: false } };

const NOTICES: Record<string, string> = {
  // /auth/callback: cancelled at Google/Facebook, provider not set up, or an expired / reused email link.
  link: "Đăng nhập chưa hoàn tất, hoặc liên kết đã hết hạn hay đã được dùng. Vui lòng thử lại.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, notice } = await searchParams;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-6">
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Đăng nhập" }]} />
      <h1 className="mb-6 text-h2 uppercase">Đăng nhập</h1>
      <LoginForm next={safeNext(next)} notice={typeof notice === "string" ? NOTICES[notice] : undefined} />
    </div>
  );
}
