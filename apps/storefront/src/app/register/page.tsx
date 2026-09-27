import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { safeNext } from "@/lib/auth";

export const metadata: Metadata = { title: "Create account | Paranoidz", robots: { index: false } };

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const { next } = await searchParams;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-6">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Create account" }]} />
      <h1 className="mb-2 text-h2 uppercase">Create account</h1>
      <p className="mb-6 max-w-md text-text-secondary">
        An account is optional: you can always order as a guest. It keeps your orders and addresses in one place.
      </p>
      <RegisterForm next={safeNext(next)} />
    </div>
  );
}
