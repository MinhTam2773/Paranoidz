import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

// Browser client (publishable key). Auth flows + RLS-owned rows only
// (ARCHITECTURE.md §2.1) — never orders, stock, vouchers or loyalty.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
