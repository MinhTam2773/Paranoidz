// Copies every Supabase Storage object (product-images, review-images) to the R2 bucket, keyed
// "{bucket}/{path}" like @paranoidz/db/media. Safe to re-run: an object already on R2 with the
// same size is skipped, so a second run after the deploy picks up only what was uploaded since.
//   pnpm --filter @paranoidz/db media:copy                 (dry run: counts only)
//   pnpm --filter @paranoidz/db media:copy -- --apply      (copy)
//   pnpm --filter @paranoidz/db media:copy -- --apply --rewrite-urls
// --rewrite-urls then points the full URLs stored in text columns (product descriptions, video
// URLs, loyalty gift images) at NEXT_PUBLIC_MEDIA_URL; storage_path columns are relative and stay.
// Needs apps/admin/.env.prod.local with the prod Supabase keys, the R2_* keys and NEXT_PUBLIC_MEDIA_URL.
import { AwsClient } from "aws4fetch";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types.ts";

const env = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} missing from apps/admin/.env.prod.local`);
  return v;
};
const apply = process.argv.includes("--apply");
const rewrite = process.argv.includes("--rewrite-urls");
const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
const admin = createClient<Database>(supabaseUrl, env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const r2 = new AwsClient({ accessKeyId: env("R2_ACCESS_KEY_ID"), secretAccessKey: env("R2_SECRET_ACCESS_KEY"), service: "s3", region: "auto" });
const endpoint = `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com/${env("R2_BUCKET")}`;
const BUCKETS = ["product-images", "review-images"] as const;

type Obj = { path: string; size: number; type: string };

// Storage's list() is one folder deep: entries without an id are sub-folders.
async function listAll(bucket: string, folder = ""): Promise<Obj[]> {
  const out: Obj[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage.from(bucket).list(folder, { limit: 1000, offset });
    if (error) throw error;
    for (const f of data) {
      const path = folder ? `${folder}/${f.name}` : f.name;
      if (f.id === null) out.push(...(await listAll(bucket, path)));
      else out.push({ path, size: f.metadata?.size ?? -1, type: f.metadata?.mimetype ?? "application/octet-stream" });
    }
    if (data.length < 1000) return out;
  }
}

async function copy(bucket: string, o: Obj): Promise<"skipped" | "copied"> {
  const key = `${endpoint}/${bucket}/${encodeURI(o.path)}`;
  const head = await r2.fetch(key, { method: "HEAD" });
  if (head.ok && Number(head.headers.get("content-length")) === o.size) return "skipped";
  if (!apply) return "copied";
  const res = await fetch(`${supabaseUrl}/storage/v1/object/public/${bucket}/${encodeURI(o.path)}`);
  if (!res.ok) throw new Error(`download ${bucket}/${o.path}: HTTP ${res.status}`);
  const body = new Uint8Array(await res.arrayBuffer());
  const put = await r2.fetch(key, { method: "PUT", body, headers: { "content-type": o.type, "cache-control": "public, max-age=31536000" } });
  if (!put.ok) throw new Error(`upload ${bucket}/${o.path}: HTTP ${put.status} ${await put.text()}`);
  return "copied";
}

let failed = 0;
for (const bucket of BUCKETS) {
  const objects = await listAll(bucket);
  const bytes = objects.reduce((n, o) => n + Math.max(0, o.size), 0);
  console.log(`${bucket}: ${objects.length} objects, ${(bytes / 1e9).toFixed(2)} GB`);
  const counts = { skipped: 0, copied: 0 };
  for (let i = 0; i < objects.length; i += 8) {
    await Promise.all(objects.slice(i, i + 8).map(async (o) => {
      try {
        counts[await copy(bucket, o)]++;
      } catch (e) {
        failed++;
        console.error(String(e));
      }
    }));
  }
  console.log(`  ${apply ? "copied" : "to copy"} ${counts.copied}, already on R2 ${counts.skipped}`);
}
if (failed) throw new Error(`${failed} objects failed; nothing rewritten. Run again.`);

if (rewrite) {
  if (!apply) throw new Error("--rewrite-urls needs --apply");
  const from = `${supabaseUrl}/storage/v1/object/public/`;
  const to = `${env("NEXT_PUBLIC_MEDIA_URL")}/`;
  const { data: products, error } = await admin.from("products").select("id, description, video_url");
  if (error) throw error;
  let n = 0;
  for (const p of products) {
    const patch: { description?: string; video_url?: string } = {};
    if (p.description?.includes(from)) patch.description = p.description.replaceAll(from, to);
    if (p.video_url?.startsWith(from)) patch.video_url = to + p.video_url.slice(from.length);
    if (!Object.keys(patch).length) continue;
    const { error: uErr } = await admin.from("products").update(patch).eq("id", p.id);
    if (uErr) throw uErr;
    n++;
  }
  const { data: gifts, error: gErr } = await admin.from("loyalty_gifts").select("id, image_url");
  if (gErr) throw gErr;
  for (const g of gifts) {
    if (!g.image_url?.startsWith(from)) continue;
    const { error: uErr } = await admin.from("loyalty_gifts").update({ image_url: to + g.image_url.slice(from.length) }).eq("id", g.id);
    if (uErr) throw uErr;
    n++;
  }
  console.log(`rewrote URLs in ${n} rows`);
}
