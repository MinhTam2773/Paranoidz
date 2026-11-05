import { uploadWithTicket } from "@paranoidz/db/media";
import { createThumbUploads } from "@/app/(shell)/products/[id]/image-actions";
import { compressImage, IMAGE_CACHE_SECONDS } from "./compress-image";

// The storefront thumbnails of one gallery photo (@paranoidz/db/thumbs), made from `source` in the
// browser like the photo itself. A failure leaves the photo in place: the storefront falls back to
// the original, and "Ảnh thu nhỏ" on the products list makes the missing ones later.
export async function uploadThumbs(productId: string, path: string, source: Blob): Promise<{ error?: string }> {
  const [big, small] = await Promise.all(
    ([600, 120] as const).map(async (width) => (await compressImage(new File([source], "thumb.jpg", { type: source.type }), width)).file),
  );
  const tickets = await createThumbUploads(productId, path, { 600: { type: big.type, size: big.size }, 120: { type: small.type, size: small.size } });
  if ("error" in tickets) return { error: tickets.error };
  for (const t of tickets.uploads) {
    const file = t.width === 600 ? big : small;
    const { error } = await uploadWithTicket("product-images", t.ticket, file, { contentType: file.type, cacheControl: IMAGE_CACHE_SECONDS });
    if (error) return { error: "Không thể tải ảnh thu nhỏ lên." };
  }
  return {};
}
