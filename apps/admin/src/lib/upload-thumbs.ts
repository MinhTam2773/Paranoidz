import { createClient } from "@paranoidz/db/client";
import { createThumbUploads } from "@/app/(shell)/products/[id]/image-actions";
import { compressImage, IMAGE_CACHE_SECONDS } from "./compress-image";

// The storefront thumbnails of one gallery photo (@paranoidz/db/thumbs), made from `source` in the
// browser like the photo itself. A failure leaves the photo in place: the storefront falls back to
// the original, and "Ảnh thu nhỏ" on the products list makes the missing ones later.
export async function uploadThumbs(productId: string, path: string, source: Blob): Promise<{ error?: string }> {
  const tickets = await createThumbUploads(productId, path);
  if ("error" in tickets) return { error: tickets.error };
  const storage = createClient().storage.from("product-images");
  for (const t of tickets.uploads) {
    const { file } = await compressImage(new File([source], "thumb.jpg", { type: source.type }), t.width);
    const { error } = await storage.uploadToSignedUrl(t.path, t.token, file, { contentType: file.type, cacheControl: IMAGE_CACHE_SECONDS });
    if (error) return { error: "Không thể tải ảnh thu nhỏ lên." };
  }
  return {};
}
