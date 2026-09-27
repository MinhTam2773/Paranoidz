import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@paranoidz/db/server";
import { NewPasswordForm } from "@/components/auth/NewPasswordForm";
import { Breadcrumb } from "@/components/layout/Breadcrumb";

export const metadata: Metadata = { title: "Change password | Paranoidz", robots: { index: false } };

// Also where the password-reset email lands, already signed in by /auth/callback.
export default async function AccountPasswordPage() {
  const { data: claims } = await (await createClient()).auth.getClaims();
  if (!claims) redirect(`/login?next=${encodeURIComponent("/account/password")}`);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-6">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Account", href: "/account" }, { label: "Change password" }]} />
      <h1 className="mb-6 text-h2 uppercase">Change password</h1>
      <NewPasswordForm />
    </div>
  );
}
