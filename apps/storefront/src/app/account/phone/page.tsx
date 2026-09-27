import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@paranoidz/db/server";
import { PhoneForm } from "@/components/auth/PhoneForm";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { safeNext } from "@/lib/auth";

export const metadata: Metadata = { title: "Add your phone | Paranoidz", robots: { index: false } };

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
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Account" }]} />
      <h1 className="mb-2 text-h2 uppercase">Add your phone number</h1>
      <p className="mb-6 max-w-md text-text-secondary">
        Every Paranoidz account needs a Vietnamese mobile number. Each number can be on one account only.
      </p>
      <PhoneForm next={next} />
    </div>
  );
}
