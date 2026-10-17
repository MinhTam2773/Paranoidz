import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ConfirmButton } from "@/components/auth/ConfirmButton";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { safeNext } from "@/lib/auth";
import { confirmEmailLink } from "./actions";

export const metadata: Metadata = { title: "Xác nhận | Paranoidz", robots: { index: false } };

// Where the sign-up and password-reset emails land (supabase/templates). Opening the page spends
// nothing: mail scanners (school / company mailboxes) open every link before the person does, and
// used to burn the single-use token, so the person got "link expired". Only the button does.
export default async function ConfirmPage({ searchParams }: PageProps<"/auth/confirm">) {
  const params = await searchParams;
  const { token_hash, type, next } = params;
  // Supabase's default templates still send /auth/v1/verify links, which come back here with a PKCE code.
  if (typeof params.code === "string") redirect(`/auth/callback?code=${encodeURIComponent(params.code)}&next=${encodeURIComponent(safeNext(next))}`);
  if (typeof token_hash !== "string" || (type !== "email" && type !== "recovery")) {
    redirect(`/login?notice=link&next=${encodeURIComponent(safeNext(next))}`);
  }
  const reset = type === "recovery";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-6">
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: reset ? "Đặt lại mật khẩu" : "Xác nhận email" }]} />
      <h1 className="mb-2 text-h2 uppercase">{reset ? "Đặt lại mật khẩu" : "Xác nhận email"}</h1>
      <p className="mb-6 max-w-md text-text-secondary">
        {reset ? "Bấm nút bên dưới để đặt mật khẩu mới." : "Bấm nút bên dưới để hoàn tất tạo tài khoản."}
      </p>
      <form action={confirmEmailLink} className="max-w-md">
        <input type="hidden" name="token_hash" value={token_hash} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="next" value={safeNext(next)} />
        <ConfirmButton label={reset ? "Đặt mật khẩu mới" : "Xác nhận email"} />
      </form>
    </div>
  );
}
