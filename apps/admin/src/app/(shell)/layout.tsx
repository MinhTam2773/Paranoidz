import { createAdminClient } from "@paranoidz/db/admin";
import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/auth";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const { email } = await requireAdmin();

  // orders have no admin RLS policy (ARCHITECTURE.md §2.3): read with service_role, after the check above.
  const { count } = await createAdminClient()
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  return (
    <AdminShell email={email} pendingCount={count ?? 0}>
      {children}
    </AdminShell>
  );
}
