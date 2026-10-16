import { PROVINCES } from "@paranoidz/db/provinces";
import { createPublicClient } from "@paranoidz/db/public";

// Delivery wards are SPX's names (spx_locations, public read): SPX only accepts its own ward
// names (ARCHITECTURE.md §5 "SPX Open API"). Keyed by our province name.
const spxProvince = (city: string) => PROVINCES.find((p) => p.name === city)?.spx;

export async function spxWards(city: string): Promise<string[]> {
  const province = spxProvince(city);
  if (!province) return [];
  const { data } = await createPublicClient().from("spx_locations").select("ward").eq("province", province);
  return (data ?? []).map((r) => r.ward).sort((a, b) => a.localeCompare(b, "vi"));
}

export async function isSpxWard(city: string, ward: string) {
  const province = spxProvince(city);
  if (!province || !ward) return false;
  const { count } = await createPublicClient()
    .from("spx_locations").select("ward", { count: "exact", head: true }).eq("province", province).eq("ward", ward);
  return !!count;
}
