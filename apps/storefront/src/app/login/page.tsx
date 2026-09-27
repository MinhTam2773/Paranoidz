import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { safeNext } from "@/lib/auth";

export const metadata: Metadata = { title: "Log in | Paranoidz", robots: { index: false } };

const NOTICES: Record<string, string> = {
  // /auth/callback: cancelled at Google/Facebook, provider not set up, or an expired / reused email link.
  link: "That sign-in didn't complete, or the link has expired or was already used. Try again.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, notice } = await searchParams;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-6">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Log in" }]} />
      <h1 className="mb-6 text-h2 uppercase">Log in</h1>
      <LoginForm next={safeNext(next)} notice={typeof notice === "string" ? NOTICES[notice] : undefined} />
    </div>
  );
}
