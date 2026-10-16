import { execSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { assertLocalSupabase } from "@paranoidz/db/testing";

export const ROOT = path.resolve(import.meta.dirname, "..");
export const STOREFRONT_URL = "http://localhost:3100";
export const ADMIN_URL = "http://localhost:3101";
export const ADMIN_STATE = path.join(import.meta.dirname, ".auth", "admin.json");

// Local Supabase URL + keys from the running CLI stack (`supabase start`). Read once in the main
// process; workers inherit process.env.
function localSupabase() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) return;
  const out = execSync("supabase status -o env", { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const vars = Object.fromEntries(
    out.split(/\r?\n/).map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/)).filter((m) => m !== null).map((m) => [m[1], m[2]]),
  );
  process.env.NEXT_PUBLIC_SUPABASE_URL = vars.API_URL;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = vars.PUBLISHABLE_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = vars.SECRET_KEY;
  process.env.E2E_MAILPIT_URL = vars.MAILPIT_URL; // the local stack's catch-all inbox (auth emails)
}

// Every key in the apps' .env files, set to "": Next.js never overrides a variable that already
// exists, so the developer's .env.local (paranoidz-test, Resend, Zalo) can't leak into the run.
function blankedAppEnv() {
  const keys = new Set<string>();
  for (const app of ["storefront", "admin"]) {
    const dir = path.join(ROOT, "apps", app);
    for (const file of readdirSync(dir).filter((f) => f.startsWith(".env"))) {
      for (const m of readFileSync(path.join(dir, file), "utf8").matchAll(/^\s*([A-Z_][A-Z0-9_]*)\s*=/gm)) keys.add(m[1]);
    }
  }
  return Object.fromEntries([...keys].map((k) => [k, ""]));
}

localSupabase();
assertLocalSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL);

export const APP_ENV: Record<string, string> = {
  ...blankedAppEnv(),
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
};
