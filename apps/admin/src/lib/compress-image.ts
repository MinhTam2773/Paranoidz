// Product photos are resized and re-encoded in the browser before upload (audit 2026-10-30:
// camera / Shopee originals up to 2.7 MB and 3332 px reached prod, and Vercel image
// optimisation is off because the free quota is spent — next.config.ts). JPEG, not WebP:
// /meta-feed.xml hands these URLs to Meta's catalog, which takes JPG / PNG.
const MAX_WIDTH = 1600;
const QUALITY = 0.82;

// One year: every upload gets a new UUID path, so an object never changes.
export const IMAGE_CACHE_SECONDS = "31536000";

// maxWidth: smaller for the storefront thumbnails (@paranoidz/db/thumbs).
export async function compressImage(file: File, maxWidth = MAX_WIDTH): Promise<{ file: File; width: number; height: number }> {
  // imageOrientation "from-image": phone photos come out the right way up.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  // JPEG has no transparency: transparent PNG areas become white, not black.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
  // Already small and not too wide: keep the original bytes.
  if (!blob || (scale === 1 && blob.size >= file.size)) return { file, width, height };
  return { file: new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }), width, height };
}
