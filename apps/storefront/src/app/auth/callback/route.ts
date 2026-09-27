import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@paranoidz/db/server";
import { afterLoginPath, safeNext } from "@/lib/auth";

// Return point for Google/Facebook and for email links (signup confirmation, password reset):
// PKCE code → session cookie, then on through the phone step. The code verifier lives in the
// browser that started the flow, so an email link opened in another browser lands on /login —
// the email itself is still confirmed, so logging in works.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const code = searchParams.get("code");

  if (code) {
    const { error } = await (await createClient()).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(afterLoginPath(next), origin));
  }
  return NextResponse.redirect(new URL(`/login?notice=link&next=${encodeURIComponent(next)}`, origin));
}
