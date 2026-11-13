import { createClient } from "./client";

// Product and review media (2026-11-04): Supabase Storage egress went over the free plan, so
// production serves and stores media on Cloudflare R2 (bucket paranoidz-media, objects keyed
// "{bucket}/{path}", public at NEXT_PUBLIC_MEDIA_URL). Rows keep the same relative storage_path.
// Without NEXT_PUBLIC_MEDIA_URL (local dev, CI, previews on the test project) everything stays on
// Supabase Storage as before. Server-side calls are in ./media-server.
export type MediaBucket = "product-images" | "review-images" | "return-images";

// What the server hands the browser for one upload: a Supabase signed-upload token, or an R2
// presigned PUT whose signed headers must be sent unchanged.
export type UploadTicket = { path: string; token: string } | { path: string; url: string; headers: Record<string, string> };

export function mediaBase(bucket: MediaBucket) {
  const media = process.env.NEXT_PUBLIC_MEDIA_URL;
  return media ? `${media}/${bucket}/` : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/`;
}

export function mediaUrl(bucket: MediaBucket, path: string) {
  return mediaBase(bucket) + encodeURI(path);
}

// Browser side of an upload. cacheControl only applies to Supabase (in seconds); an R2 ticket
// already carries its Cache-Control header.
export async function uploadWithTicket(
  bucket: MediaBucket,
  ticket: UploadTicket,
  file: Blob,
  options: { contentType: string; cacheControl?: string },
): Promise<{ error?: string }> {
  if ("token" in ticket) {
    const { error } = await createClient().storage.from(bucket).uploadToSignedUrl(ticket.path, ticket.token, file, options);
    return error ? { error: error.message } : {};
  }
  try {
    const res = await fetch(ticket.url, { method: "PUT", headers: ticket.headers, body: file });
    return res.ok ? {} : { error: `HTTP ${res.status}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "upload failed" };
  }
}
