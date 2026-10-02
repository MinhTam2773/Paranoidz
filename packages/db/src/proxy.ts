import { createServerClient } from "@supabase/ssr";
import type { JwtPayload, SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./types";

// Optional per-app access check. Return a path to redirect there, or null to let
// the request through. Cookie changes it makes (e.g. signOut) ride along.
export type SessionGuard = (
  supabase: SupabaseClient<Database>,
  claims: JwtPayload | undefined,
) => Promise<string | null>;

// Session refresh for each app's src/proxy.ts (Next 16's renamed middleware).
// Creating the client alone refreshes nothing — the auth call below is what
// rotates an expired token and triggers setAll.
export async function updateSession(request: NextRequest, guard?: SessionGuard) {
  let response = NextResponse.next({ request });
  let cacheHeaders: Record<string, string> = {};

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          // Forward to the request so Server Components in this pass see the
          // fresh token, then rebuild the response to carry it to the browser.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          // No-cache headers: a CDN must never serve one user's session cookie
          // to another.
          cacheHeaders = headers;
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // Do not put code between createServerClient and this call.
  const { data } = await supabase.auth.getClaims();

  const redirectTo = guard ? await guard(supabase, data?.claims) : null;
  if (!redirectTo) return response;

  const redirect = NextResponse.redirect(new URL(redirectTo, request.url));
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  Object.entries(cacheHeaders).forEach(([key, value]) => redirect.headers.set(key, value));
  return redirect;
}
