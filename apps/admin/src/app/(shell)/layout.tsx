import { createAdminClient } from "@paranoidz/db/admin";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requireAdmin();

  // orders have no admin RLS policy (ARCHITECTURE.md §2.3): read with service_role, after the check above.
  const admin = createAdminClient();
  const [{ count }, { count: returnCount }] = await Promise.all([
    admin.from("orders").select("*", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("return_requests").select("*", { count: "exact", head: true }).eq("status", "requested"),
  ]);

  return (
    <AdminShell email={email} pendingCount={count ?? 0} returnCount={returnCount ?? 0}>
      {children}
    </AdminShell>
  );
}
