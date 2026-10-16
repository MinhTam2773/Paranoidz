import { test } from "node:test";
import assert from "node:assert/strict";
import { createPublicClient } from "@paranoidz/db/public";
import { PROVINCES } from "@paranoidz/db/provinces";

// Reads the database in .env.local as anon (spx_locations is public), after
// `pnpm --filter @paranoidz/db seed:spx-locations`.
test("every province maps to a distinct SPX province that has wards", async () => {
  assert.equal(PROVINCES.length, 34);
  assert.equal(new Set(PROVINCES.map((p) => p.spx)).size, 34);

  const supabase = createPublicClient();
  const missing: string[] = [];
  await Promise.all(
    PROVINCES.map(async (p) => {
      const { count, error } = await supabase
        .from("spx_locations").select("*", { count: "exact", head: true }).eq("province", p.spx);
      if (error) throw error;
      if (!count) missing.push(`${p.name} → ${p.spx}`);
    }),
  );
  assert.deepEqual(missing, []);
});
