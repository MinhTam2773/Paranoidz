"use server";

import { redirect } from "next/navigation";
import { createClient } from "@paranoidz/db/server";
import { afterLoginPath, safeNext } from "@/lib/auth";

// The button on /auth/confirm. Spends the single-use token and signs the visitor in, in whatever
// browser opened the email (no PKCE verifier needed).
export async function confirmEmailLink(form: FormData) {
  const tokenHash = form.get("token_hash");
  const type = form.get("type");
  const next = safeNext(form.get("next"));
  if (typeof tokenHash !== "string" || !tokenHash || (type !== "email" && type !== "recovery")) redirect("/login");

  const { error } = await (await createClient()).auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) redirect(type === "recovery" ? "/login?notice=reset" : `/login?notice=confirm&next=${encodeURIComponent(next)}`);
  redirect(afterLoginPath(next));
}
