"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@paranoidz/db/admin";
import { THUMB_WIDTHS, thumbPath } from "@paranoidz/db/thumbs";
import { requireAdmin } from "@/lib/auth";

// Product photos (DASHBOARD_DESIGN.md §5 Image uploader). Bytes go browser →
// Storage through a signed upload URL issued here; the bucket enforces type and
// size (migration 20261006000001). Rows: position = sort_order, and the first
// image is the cover (is_primary), so the storefront card (lowest sort_order),
// the admin thumbnail and order snapshots agree.

const BUCKET = "product-images";
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_IMAGES = 20;

type Result = { error?: string };

async function loadProduct(productId: string) {
  const { data } = await createAdminClient()
    .from("products")
    .select("id, slug, product_variants(color), product_images(id, storage_path, sort_order, is_primary)")
    .eq("id", productId)
    .maybeSingle();
  return data;
}

const done = (productId: string): Result => {
  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
  return {};
};

export async function createImageUpload(productId: string, contentType: string, size: number) {
  await requireAdmin();
  const ext = TYPES[contentType];
  if (!ext) return { error: "Chỉ nhận ảnh JPG, PNG hoặc WebP." };
  if (!(size > 0 && size <= MAX_BYTES)) return { error: "Ảnh tối đa 10 MB." };
  const product = await loadProduct(productId);
  if (!product) return { error: "Không tìm thấy sản phẩm." };
  if (product.product_images.length >= MAX_IMAGES) return { error: `Tối đa ${MAX_IMAGES} ảnh mỗi sản phẩm.` };

  const path = `products/${product.slug}/${randomUUID()}.${ext}`;
  const { data, error } = await createAdminClient().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) return { error: "Không thể tải ảnh lên. Vui lòng thử lại." };
  return { path: data.path, token: data.token };
}

// After the browser upload: register the row. The path must be in this product's
// folder and the object must exist (the token only allowed that one path).
export async function addProductImage(productId: string, path: string, color: string | null): Promise<Result> {
  await requireAdmin();
  const product = await loadProduct(productId);
  if (!product) return { error: "Không tìm thấy sản phẩm." };
  const admin = createAdminClient();
  if (!new RegExp(`^products/${product.slug}/[0-9a-f-]{36}\\.(jpg|png|webp)$`).test(path)) return { error: "Đường dẫn ảnh không hợp lệ." };
  if (color !== null && !product.product_variants.some((v) => v.color === color)) return { error: "Màu không thuộc sản phẩm này." };
  const { data: exists } = await admin.storage.from(BUCKET).exists(path);
  if (!exists) return { error: "Ảnh chưa được tải lên. Vui lòng thử lại." };

  const last = Math.max(-1, ...product.product_images.map((i) => i.sort_order));
  const { error } = await admin.from("product_images").insert({
    product_id: productId, storage_path: path, color, sort_order: last + 1, is_primary: product.product_images.length === 0,
  });
  if (error) {
    await admin.storage.from(BUCKET).remove([path]);
    return { error: "Không thể lưu ảnh. Vui lòng thử lại." };
  }
  return done(productId);
}

// Description images (2026-10-17): embedded in the product description HTML
// (<img> tags), not gallery rows. They live under products/{slug}/desc/ so the
// addProductImage path check never confuses them with gallery photos.
export async function createDescriptionImageUpload(productId: string, contentType: string, size: number) {
  await requireAdmin();
  const ext = TYPES[contentType];
  if (!ext) return { error: "Chỉ nhận ảnh JPG, PNG hoặc WebP." };
  if (!(size > 0 && size <= MAX_BYTES)) return { error: "Ảnh tối đa 10 MB." };
  const product = await loadProduct(productId);
  if (!product) return { error: "Không tìm thấy sản phẩm." };

  const admin = createAdminClient();
  const path = `products/${product.slug}/desc/${randomUUID()}.${ext}`;
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) return { error: "Không thể tải ảnh lên. Vui lòng thử lại." };
  return {
    path: data.path,
    token: data.token,
    publicUrl: admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl,
  };
}

// Product video (2026-10-30): uploaded to products/{slug}/video/; the form puts the public URL in
// products.video_url, which is saved with the product. Size / type also enforced by the bucket
// (migration 20261030000001).
const VIDEO_TYPES: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm" };
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export async function createVideoUpload(productId: string, contentType: string, size: number) {
  await requireAdmin();
  const ext = VIDEO_TYPES[contentType];
  if (!ext) return { error: "Chỉ nhận video MP4 hoặc WebM." };
  if (!(size > 0 && size <= MAX_VIDEO_BYTES)) return { error: "Video tối đa 50 MB." };
  const product = await loadProduct(productId);
  if (!product) return { error: "Không tìm thấy sản phẩm." };

  const admin = createAdminClient();
  const path = `products/${product.slug}/video/${randomUUID()}.${ext}`;
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) return { error: "Không thể tải video lên. Vui lòng thử lại." };
  return {
    path: data.path,
    token: data.token,
    publicUrl: admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl,
  };
}

// Thumbnails (2026-10-31, @paranoidz/db/thumbs): the browser makes them right after the photo
// and uploads them here. upsert: the backfill below can run again over the same photo.
export async function createThumbUploads(productId: string, path: string) {
  await requireAdmin();
  const product = await loadProduct(productId);
  if (!product) return { error: "Không tìm thấy sản phẩm." };
  if (!new RegExp(`^products/${product.slug}/[0-9a-f-]{36}\\.(jpg|png|webp)$`).test(path)) return { error: "Đường dẫn ảnh không hợp lệ." };
  const storage = createAdminClient().storage.from(BUCKET);
  const uploads: { width: (typeof THUMB_WIDTHS)[number]; path: string; token: string }[] = [];
  for (const width of THUMB_WIDTHS) {
    const { data, error } = await storage.createSignedUploadUrl(thumbPath(path, width), { upsert: true });
    if (error) return { error: "Không thể tải ảnh thu nhỏ lên." };
    uploads.push({ width, path: data.path, token: data.token });
  }
  return { uploads };
}

// Gallery photos that still lack a thumbnail (photos uploaded before thumbnails existed, or a
// failed thumbnail upload), for the backfill button on the products list.
export async function listMissingThumbs() {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: rows } = await admin.from("product_images").select("product_id, storage_path, products(slug)");
  const slugs = [...new Set((rows ?? []).flatMap((r) => (r.products ? [r.products.slug] : [])))];
  const have = new Set<string>();
  // One listing per product folder, 10 at a time.
  for (let i = 0; i < slugs.length; i += 10) {
    await Promise.all(slugs.slice(i, i + 10).map(async (slug) => {
      const { data: files } = await admin.storage.from(BUCKET).list(`products/${slug}/thumbs`, { limit: 1000 });
      for (const f of files ?? []) have.add(`products/${slug}/thumbs/${f.name}`);
    }));
  }
  return (rows ?? [])
    .filter((img) => {
      const wanted = THUMB_WIDTHS.map((w) => thumbPath(img.storage_path, w));
      return wanted[0] !== img.storage_path && !wanted.every((p) => have.has(p));
    })
    .map((img) => ({ productId: img.product_id, path: img.storage_path, url: admin.storage.from(BUCKET).getPublicUrl(img.storage_path).data.publicUrl }));
}

// orderedIds = every image of the product in the new order.
export async function reorderProductImages(productId: string, orderedIds: string[]): Promise<Result> {
  await requireAdmin();
  const product = await loadProduct(productId);
  if (!product) return { error: "Không tìm thấy sản phẩm." };
  const current = new Set(product.product_images.map((i) => i.id));
  if (orderedIds.length !== current.size || !orderedIds.every((id) => current.has(id))) {
    return { error: "Danh sách ảnh đã thay đổi. Tải lại trang." };
  }
  await writeOrder(orderedIds);
  return done(productId);
}

async function writeOrder(orderedIds: string[]) {
  const admin = createAdminClient();
  await Promise.all(
    orderedIds.map((id, i) => admin.from("product_images").update({ sort_order: i, is_primary: i === 0 }).eq("id", id)),
  );
}

export async function setImageColor(productId: string, imageId: string, color: string | null): Promise<Result> {
  await requireAdmin();
  const product = await loadProduct(productId);
  if (!product?.product_images.some((i) => i.id === imageId)) return { error: "Không tìm thấy ảnh." };
  if (color !== null && !product.product_variants.some((v) => v.color === color)) return { error: "Màu không thuộc sản phẩm này." };
  const { error } = await createAdminClient().from("product_images").update({ color }).eq("id", imageId);
  if (error) return { error: "Không thể lưu. Vui lòng thử lại." };
  return done(productId);
}

export async function deleteProductImage(productId: string, imageId: string): Promise<Result> {
  await requireAdmin();
  const product = await loadProduct(productId);
  const image = product?.product_images.find((i) => i.id === imageId);
  if (!product || !image) return { error: "Không tìm thấy ảnh." };
  const admin = createAdminClient();
  const { error } = await admin.from("product_images").delete().eq("id", imageId);
  if (error) return { error: "Không thể xóa ảnh. Vui lòng thử lại." };
  // order_items.image_snapshot stores the path, not a copy: keep the file while
  // any order shows it, so past orders keep their photo.
  const { count } = await admin.from("order_items").select("id", { count: "exact", head: true }).eq("image_snapshot", image.storage_path);
  if (!count) await admin.storage.from(BUCKET).remove([image.storage_path, ...THUMB_WIDTHS.map((w) => thumbPath(image.storage_path, w))]);
  const rest = product.product_images.filter((i) => i.id !== imageId).sort((a, b) => a.sort_order - b.sort_order);
  await writeOrder(rest.map((i) => i.id));
  return done(productId);
}
