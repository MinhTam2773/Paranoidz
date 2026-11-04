import "server-only";
import { AwsClient } from "aws4fetch";
import { createAdminClient } from "./admin";
import type { MediaBucket, UploadTicket } from "./media";

// Server side of ./media. R2 is used when all four R2_* variables are set (production only);
// otherwise these are the Supabase Storage calls the apps made before.
const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
const r2 = R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET
  ? { client: new AwsClient({ accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, service: "s3", region: "auto" }),
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}` }
  : null;

const objectUrl = (bucket: MediaBucket, path: string) => `${r2!.endpoint}/${bucket}/${encodeURI(path)}`;

// One upload of exactly `size` bytes of `contentType`. On R2 the type and size are part of the
// signature, so the browser can't send another file; Supabase enforces them on the bucket.
// upsert only matters on Supabase (an R2 PUT always replaces).
export async function createUploadTicket(
  bucket: MediaBucket,
  path: string,
  file: { contentType: string; size: number; cacheSeconds?: number },
  options: { upsert?: boolean } = {},
): Promise<UploadTicket | null> {
  if (!r2) {
    const { data, error } = await createAdminClient().storage.from(bucket).createSignedUploadUrl(path, { upsert: options.upsert ?? false });
    return error ? null : { path: data.path, token: data.token };
  }
  const headers: Record<string, string> = { "content-type": file.contentType, "content-length": String(file.size) };
  if (file.cacheSeconds) headers["cache-control"] = `public, max-age=${file.cacheSeconds}`;
  const url = new URL(objectUrl(bucket, path));
  url.searchParams.set("X-Amz-Expires", "600");
  const signed = await r2.client.sign(url.toString(), { method: "PUT", headers, aws: { signQuery: true, allHeaders: true } });
  delete headers["content-length"]; // the browser sets it from the body; it is still signed
  return { path, url: signed.url, headers };
}

export async function mediaExists(bucket: MediaBucket, path: string) {
  if (!r2) return (await createAdminClient().storage.from(bucket).exists(path)).data === true;
  return (await r2.client.fetch(objectUrl(bucket, path), { method: "HEAD" })).ok;
}

export async function putMedia(bucket: MediaBucket, path: string, body: Uint8Array<ArrayBuffer> | ArrayBuffer, contentType: string): Promise<{ error?: string }> {
  if (!r2) {
    const { error } = await createAdminClient().storage.from(bucket).upload(path, body, { contentType });
    return error ? { error: error.message } : {};
  }
  const res = await r2.client.fetch(objectUrl(bucket, path), { method: "PUT", body, headers: { "content-type": contentType } });
  return res.ok ? {} : { error: `HTTP ${res.status}` };
}

export async function removeMedia(bucket: MediaBucket, paths: string[]) {
  if (!paths.length) return;
  if (!r2) {
    await createAdminClient().storage.from(bucket).remove(paths);
    return;
  }
  await Promise.all(paths.map((p) => r2.client.fetch(objectUrl(bucket, p), { method: "DELETE" })));
}

// File names directly under `folder` (no recursion), like Storage's list().
export async function listMedia(bucket: MediaBucket, folder: string): Promise<string[]> {
  if (!r2) {
    const { data } = await createAdminClient().storage.from(bucket).list(folder, { limit: 1000 });
    return (data ?? []).map((f) => f.name);
  }
  const prefix = `${bucket}/${folder}/`;
  const names: string[] = [];
  let token: string | undefined;
  do {
    const url = new URL(r2.endpoint);
    url.searchParams.set("list-type", "2");
    url.searchParams.set("prefix", prefix);
    url.searchParams.set("delimiter", "/");
    if (token) url.searchParams.set("continuation-token", token);
    const xml = await (await r2.client.fetch(url.toString())).text();
    for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) names.push(m[1].slice(prefix.length));
    token = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1];
  } while (token);
  return names;
}
