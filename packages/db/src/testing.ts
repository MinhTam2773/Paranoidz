import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// service_role client for the e2e tests (e2e/), which run in plain Node — admin.ts can't be
// imported there ("server-only"). Refuses anything but a local Supabase, so a misconfigured run
// can never write to prod or paranoidz-test (docs/superpowers/specs/2026-10-15-e2e-ci-design.md).
export function assertLocalSupabase(url: string | undefined) {
  const host = url ? new URL(url).hostname : "";
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(`e2e refuses to run against ${host || "an unset Supabase URL"}: only a local Supabase (127.0.0.1 / localhost) is allowed`);
  }
}

export function createLocalTestClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  assertLocalSupabase(url);
  return createClient<Database>(url!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
