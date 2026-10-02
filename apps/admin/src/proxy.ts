import type { NextRequest } from "next/server";
import { updateSession } from "@paranoidz/db/proxy";

// The admin gate: every page, server action and route handler passes through
// here. is_admin is read from profiles on each request (server-only column), so
// revoking it takes effect immediately.
export async function proxy(request: NextRequest) {
  const onLogin = request.nextUrl.pathname === "/login";

  return updateSession(request, async (supabase, claims) => {
    if (!claims) return onLogin ? null : "/login";

    const { data } = await supabase.from("profiles").select("is_admin").eq("id", claims.sub).maybeSingle();
    if (data?.is_admin) return onLogin ? "/" : null;

    // Signed in but not an admin: end this session only ("local") so the
    // account's storefront sessions elsewhere stay signed in.
    await supabase.auth.signOut({ scope: "local" });
    return "/login?notice=forbidden";
  });
}

export const config = {
  // Skip static assets and images; every page/route refreshes the session.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)"],
};
