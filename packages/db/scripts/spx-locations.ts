// Copies SPX's public province → ward list (address_version 2) into spx_locations.
// Run: pnpm --filter @paranoidz/db seed:spx-locations   (needs apps/admin/.env.local)
//
// Source: the location API behind spx.vn's own address pickers (no keys needed).
// Idempotent: per province, wards SPX no longer lists are deleted, new ones inserted.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing from apps/admin/.env.local");
const admin = createClient<Database>(url, secret, { auth: { persistSession: false } });

type Location = { name: string; location_id: number };

async function subLocations(id: number): Promise<Location[]> {
  const res = await fetch(
    "https://spx.vn/shipment/merchant/open/location/get_sub_location_layer_info" +
      `?country=VN&location_id=${id}&sub_level=1&address_version=2`,
    { signal: AbortSignal.timeout(15_000) },
  );
  const json = await res.json();
  if (!res.ok || json.retcode !== 0) throw new Error(`SPX location ${id}: ${res.status} ${JSON.stringify(json)}`);
  return json.data.sub_location_info;
}

const provinces = await subLocations(-1);
if (provinces.length !== 34) throw new Error(`expected 34 provinces from SPX, got ${provinces.length}`);

let total = 0;
for (const p of provinces) {
  const wards = [...new Set((await subLocations(p.location_id)).map((w) => w.name))];
  if (wards.length === 0) throw new Error(`SPX lists no wards for ${p.name}`);

  const { data: existing, error: readError } = await admin
    .from("spx_locations").select("ward").eq("province", p.name);
  if (readError) throw readError;
  const stale = existing.map((r) => r.ward).filter((w) => !wards.includes(w));
  if (stale.length > 0) {
    const { error } = await admin.from("spx_locations").delete().eq("province", p.name).in("ward", stale);
    if (error) throw error;
  }

  const { error } = await admin.from("spx_locations").upsert(
    wards.map((ward) => ({ province: p.name, ward })),
    { onConflict: "province,ward", ignoreDuplicates: true },
  );
  if (error) throw error;
  console.log(`${p.name}: ${wards.length} wards${stale.length ? `, ${stale.length} removed` : ""}`);
  total += wards.length;
}
console.log(`${provinces.length} provinces, ${total} wards`);
