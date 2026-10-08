import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@paranoidz/db/server";
import { PhoneForm } from "@/components/auth/PhoneForm";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { safeNext } from "@/lib/auth";

export const metadata: Metadata = { title: "Thêm số điện thoại | Paranoidz", robots: { index: false } };

// Every login passes through here (afterLoginPath). Phone is required per account
// (ARCHITECTURE.md §1) but OAuth signups arrive without one, and a signup phone that another
// account already has is dropped — so this is where it gets filled in.
export default async function AccountPhonePage({ searchParams }: PageProps<"/account/phone">) {
  const next = safeNext((await searchParams).next);
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims) redirect(`/login?next=${encodeURIComponent(next)}`);

  const { data: profile } = await supabase.from("profiles").select("phone").eq("id", claims.claims.sub).single();
  if (profile?.phone) redirect(next);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-6">
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Tài khoản" }]} />
      <h1 className="mb-2 text-h2 uppercase">Thêm số điện thoại</h1>
      <p className="mb-6 max-w-md text-text-secondary">
        Mỗi tài khoản Paranoidz cần một số di động Việt Nam. Mỗi số chỉ dùng được cho một tài khoản.
      </p>
      <PhoneForm next={next} />
    </div>
  );
}
