import { redirect } from "next/navigation";
import { createClient } from "@paranoidz/db/server";

// Second check behind the proxy gate (src/proxy.ts), for server code about to use
// the service_role client. Layouts don't re-run on every client navigation, so
// pages and actions that read or write with createAdminClient() call this too.
export async function requireAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", claims.sub).maybeSingle();
  if (!profile?.is_admin) redirect("/login?notice=forbidden");

  return { email: claims.email ?? "" };
}
