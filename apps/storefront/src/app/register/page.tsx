import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { safeNext } from "@/lib/auth";

export const metadata: Metadata = { title: "Tạo tài khoản | Paranoidz", robots: { index: false } };

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const { next } = await searchParams;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-6">
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Tạo tài khoản" }]} />
      <h1 className="mb-2 text-h2 uppercase">Tạo tài khoản</h1>
      <p className="mb-6 max-w-md text-text-secondary">
        Tài khoản là không bắt buộc: bạn luôn có thể đặt hàng không cần đăng nhập. Tài khoản giúp lưu đơn hàng và địa chỉ của bạn ở một nơi.
      </p>
      <RegisterForm next={safeNext(next)} />
    </div>
  );
}
