import { LoginForm } from "@/components/LoginForm";

const NOTICES: Record<string, string> = {
  // Set by the proxy gate after it signs a non-admin account out.
  forbidden: "Tài khoản này không có quyền quản trị.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { notice } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-sm border border-border bg-surface p-6">
        <p className="mb-6 flex flex-col leading-none">
          <span className="font-logo text-page-title italic uppercase tracking-[0.05em]">Paranoidz</span>
          <span className="text-stat-label uppercase text-text-muted">Admin</span>
        </p>
        <h1 className="mb-6 text-card-title uppercase">Đăng nhập</h1>
        <LoginForm notice={typeof notice === "string" ? NOTICES[notice] : undefined} />
      </div>
    </div>
  );
}
