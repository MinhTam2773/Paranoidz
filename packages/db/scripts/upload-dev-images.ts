// Uploads placeholder photos for the dev seed catalog to the product-images bucket.
// Run: pnpm --filter @paranoidz/db seed:images   (needs apps/admin/.env.local)
//
// Source: Unsplash (https://unsplash.com/license — free for commercial use, no
// attribution required; Unsplash+ premium photos excluded). Chosen with no visible
// third-party brand logos. PLACEHOLDERS ONLY — replace with the client's photos
// before launch. Idempotent (upsert); fails if a seeded path has no photo here.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing from apps/admin/.env.local");
const admin = createClient<Database>(url, secret, { auth: { persistSession: false } });

const BUCKET = "product-images";

// [storage path, unsplash.com/photos/<id>, images.unsplash.com/<file>]
const PHOTOS: [string, string, string][] = [
  ["products/paranoid-logo-tee/main.jpg", "Cs4GVbMqKGY", "photo-1610502778270-c5c6f4c7d575"],
  ["products/paranoid-logo-tee/black-1.jpg", "zneickOATGk", "photo-1666358777322-a25eda95848f"],
  ["products/paranoid-logo-tee/white-1.jpg", "4rUYuwJ2vGw", "photo-1651761179569-4ba2aa054997"],
  ["products/static-noise-tee/main.jpg", "xXVdClXqsOM", "photo-1750767303711-fbfdb282af44"],
  ["products/static-noise-tee/black-1.jpg", "3qqiMT2LdR8", "photo-1571455786673-9d9d6c194f90"],
  ["products/static-noise-tee/grey-1.jpg", "fRYiPM3mNXQ", "photo-1737094540214-261561588b89"],
  ["products/night-shift-boxy-tee/main.jpg", "acn5ERAeSb4", "photo-1581655353564-df123a1eb820"],
  ["products/night-shift-boxy-tee/white-1.jpg", "WWesmHEgXDs", "photo-1521572163474-6864f9cf17ab"],
  ["products/overthink-hoodie/main.jpg", "lETfyhB8g4Q", "photo-1673092147872-5ddb03194341"],
  ["products/overthink-hoodie/black-1.jpg", "r-fZqxXDG-8", "photo-1647797819874-f51a8a8fc5c0"],
  ["products/overthink-hoodie/cream-1.jpg", "uNMH2TKD0MQ", "photo-1592485641225-bdbadeaa601e"],
  ["products/signal-zip-hoodie/main.jpg", "y-T8QTF2Vf0", "photo-1676877890050-a3bb694b37a7"],
  ["products/signal-zip-hoodie/charcoal-1.jpg", "rI0OiRBx4ac", "photo-1564858775545-e2d21c3ceee0"],
  ["products/paranoid-cargo-pants/main.jpg", "H_0kC7Rzq1o", "photo-1789938581123-ed5a5cfddbcf"],
  ["products/paranoid-cargo-pants/black-1.jpg", "d5GlpSOAzzg", "photo-1548883354-7622d03aca27"],
  ["products/paranoid-cargo-pants/olive-1.jpg", "PPrPaki9cKo", "photo-1545272957-4a9a90740ce1"],
  ["products/wide-leg-denim/main.jpg", "j_3IlDX-6uQ", "photo-1715758890151-2c15d5d482aa"],
  ["products/wide-leg-denim/washed-blue-1.jpg", "CjVrI9hBuQE", "photo-1767899390509-892ad3978dfa"],
  ["products/void-track-shorts/main.jpg", "_yPf_vbwrBA", "photo-1628476801147-b3e3cb99fe68"],
  ["products/void-track-shorts/black-1.jpg", "FMNNtx1V3WA", "photo-1789110519709-7a5311b51cb9"],
  ["products/eye-logo-cap/main.jpg", "AP_qief3n94", "photo-1609868656710-4f299e957ec5"],
  ["products/eye-logo-cap/black-1.jpg", "a6PIHHL7d4I", "photo-1737666636073-f15d9762cf83"],
  ["products/eye-logo-cap/beige-1.jpg", "gcZcCqpGEw0", "photo-1656166229825-8bb5c3214111"],
  ["products/paranoidz-tote-bag/main.jpg", "PENodSVsL1s", "photo-1630381260512-e3fe55c11973"],
  ["products/paranoidz-tote-bag/cream-1.jpg", "smTDI-z1rlY", "photo-1574365569389-a10d488ca3fb"],
];

const { data: rows, error } = await admin.from("product_images").select("storage_path");
if (error) throw error;
const missing = rows.map((r) => r.storage_path).filter((p) => !PHOTOS.some(([path]) => path === p));
if (missing.length) throw new Error(`No photo for seeded path(s): ${missing.join(", ")}`);

for (const [path, , file] of PHOTOS) {
  // 1200×1600 = the 3:4 product-card ratio (DESIGN.md §4), centre crop.
  const res = await fetch(`https://images.unsplash.com/${file}?w=1200&h=1600&fit=crop&fm=jpg&q=80`);
  if (!res.ok) throw new Error(`${path}: download failed (${res.status})`);
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, await res.arrayBuffer(), { contentType: "image/jpeg", upsert: true });
  if (uploadError) throw new Error(`${path}: ${uploadError.message}`);
  console.log(`uploaded  ${path}`);
}
console.log(`${PHOTOS.length} photos in ${BUCKET}`);
