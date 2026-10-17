import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { safeNext } from "@/lib/auth";

export const metadata: Metadata = { title: "Đăng nhập | Paranoidz", robots: { index: false } };

const NOTICES: Record<string, string> = {
  // /auth/callback: cancelled at Google/Facebook, provider not set up, or an expired / reused email link.
  // A sign-up link can fail after the email was confirmed (opened twice, or by a mail scanner).
  link: "Đăng nhập chưa hoàn tất, hoặc liên kết đã hết hạn hay đã được dùng. Nếu bạn vừa xác nhận email, tài khoản có thể đã sẵn sàng: hãy đăng nhập bên dưới.",
  // /auth/confirm, sign-up link refused. Signing up again with the same email sends a new link.
  confirm: "Liên kết xác nhận đã hết hạn hoặc đã được dùng. Nếu bạn đã xác nhận trước đó, hãy đăng nhập bên dưới. Nếu chưa, hãy đăng ký lại bằng email này để nhận liên kết mới.",
  // /auth/confirm, password-reset link refused.
  reset: "Liên kết đặt lại mật khẩu đã hết hạn hoặc đã được dùng. Bấm “Quên mật khẩu?” để nhận liên kết mới.",
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
