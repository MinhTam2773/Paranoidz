import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Cookieless publishable-key client for PUBLIC catalog reads in Server Components
// (products, variants, images, categories — anon RLS, active rows only).
// Reading no cookies lets those pages be ISR-cached (ARCHITECTURE.md §2.2).
// Never use it for anything user-specific: it has no session, so auth.uid() is null.
export function createPublicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
