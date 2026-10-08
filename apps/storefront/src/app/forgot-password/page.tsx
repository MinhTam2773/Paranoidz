import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { Breadcrumb } from "@/components/layout/Breadcrumb";

export const metadata: Metadata = { title: "Quên mật khẩu | Paranoidz", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-6">
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Đăng nhập", href: "/login" }, { label: "Quên mật khẩu" }]} />
      <h1 className="mb-2 text-h2 uppercase">Quên mật khẩu</h1>
      <p className="mb-6 max-w-md text-text-secondary">Nhập email của bạn, chúng tôi sẽ gửi liên kết để đặt mật khẩu mới.</p>
      <ForgotPasswordForm />
    </div>
  );
}
