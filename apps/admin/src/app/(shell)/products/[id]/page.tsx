import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@paranoidz/db/admin";
import { ColorRename } from "@/components/products/ColorRename";
import { GiftVariantPicker } from "@/components/products/GiftVariantPicker";
import { ImageManager } from "@/components/products/ImageManager";
import { ProductEditor } from "@/components/products/ProductForm";
import { requireAdmin } from "@/lib/auth";
import { sizeGuideToText } from "@/lib/product";

// Same order as the storefront's size picker; unknown sizes last.
const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "FREE"];
const sizeRank = (s: string) => (SIZE_ORDER.indexOf(s.toUpperCase()) + 1 || SIZE_ORDER.length + 1);

export default async function EditProductPage({ params }: PageProps<"/products/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const admin = createAdminClient();

  const [{ data: product, error }, { data: categories }, { data: gift }] = await Promise.all([
    admin
      .from("products")
      .select("id, name, slug, category_id, description, care_instructions, size_guide, is_active, updated_at, shopee_sold_count, gift_label, video_url, video_poster_url, earns_perks, product_variants(id, color, color_hex, size, price, original_price, stock, sku, is_order_gift, updated_at), product_images(id, storage_path, color, sort_order, is_primary)")
      .eq("id", id)
      .maybeSingle(),
    admin.from("categories").select("id, name").order("sort_order"),
    admin.from("product_variants").select("product_id, color, size, products(name)").eq("is_order_gift", true).maybeSingle(),
  ]);
  if (error) throw error;
  if (!product) notFound();

  const variants = [...product.product_variants].sort(
    (a, b) => a.color.localeCompare(b.color, "vi") || sizeRank(a.size) - sizeRank(b.size) || a.size.localeCompare(b.size),
  );
  const storage = admin.storage.from("product-images");
  const images = [...product.product_images]
    .sort((a, b) => a.sort_order - b.sort_order || Number(b.is_primary) - Number(a.is_primary))
    .map((i) => ({ id: i.id, color: i.color, url: storage.getPublicUrl(i.storage_path).data.publicUrl }));
  const colors = [...new Set(variants.map((v) => v.color))];
  // First non-null hex per colour: a size added after the hex was picked has none yet.
  const colorHexes = colors.map((c) => ({ name: c, hex: variants.find((v) => v.color === c && v.color_hex)?.color_hex ?? null }));
  // Any saved change (product row or any variant, incl. stock from an order) gives a new key.
  const version = [product.updated_at, ...variants.map((v) => `${v.id}:${v.stock}:${v.updated_at}`)].join("|");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Link href="/products" className="text-label uppercase text-text-secondary hover:text-text-primary">‹ Sản phẩm</Link>
        <h2 className="text-page-title wrap-break-word">{product.name}</h2>
      </div>
      <ImageManager productId={product.id} productName={product.name} images={images} colors={colors} />
      <ColorRename key={colorHexes.map((c) => `${c.name}:${c.hex}`).join("|")} productId={product.id} colors={colorHexes} images={images} />
      <GiftVariantPicker
        key={variants.map((v) => `${v.id}:${v.is_order_gift}`).join("|")}
        productId={product.id}
        variants={variants.map((v) => ({ id: v.id, color: v.color, size: v.size, isGift: v.is_order_gift }))}
        elsewhere={gift && gift.product_id !== product.id ? `${gift.products?.name} · ${gift.color} / ${gift.size}` : null}
      />
      <ProductEditor
        version={version}
        categories={categories ?? []}
        initial={{
          id: product.id,
          name: product.name,
          slug: product.slug,
          categoryId: product.category_id ?? "",
          description: product.description ?? "",
          careInstructions: product.care_instructions ?? "",
          sizeGuide: sizeGuideToText(product.size_guide),
          shopeeSoldCount: product.shopee_sold_count ?? 0,
          giftLabel: product.gift_label ?? "",
          videoUrl: product.video_url ?? "",
          videoPosterUrl: product.video_poster_url ?? "",
          earnsPerks: product.earns_perks,
          isActive: product.is_active,
          variants: variants.map((v) => ({
            id: v.id,
            color: v.color,
            size: v.size,
            price: String(v.price),
            originalPrice: v.original_price ? String(v.original_price) : "",
            stock: String(v.stock),
            expectedStock: v.stock,
            sku: v.sku ?? "",
          })),
        }}
      />
    </div>
  );
}
