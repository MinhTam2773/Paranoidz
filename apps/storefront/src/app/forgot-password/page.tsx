import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { Breadcrumb } from "@/components/layout/Breadcrumb";

export const metadata: Metadata = { title: "Forgot password | Paranoidz", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-6">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Log in", href: "/login" }, { label: "Forgot password" }]} />
      <h1 className="mb-2 text-h2 uppercase">Forgot password</h1>
      <p className="mb-6 max-w-md text-text-secondary">Enter your email and we&apos;ll send you a link to choose a new password.</p>
      <ForgotPasswordForm />
    </div>
  );
}
