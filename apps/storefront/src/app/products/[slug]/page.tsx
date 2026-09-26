import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createPublicClient } from "@paranoidz/db/public";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ProductView } from "@/components/product/ProductView";
import { SizeGuide, isSizeGuide } from "@/components/product/SizeGuide";

// ISR (ARCHITECTURE.md §2.2): every active product is prebuilt at deploy, then rebuilt at most once a
// minute; slugs added later render on first visit. Shown stock is display only — place_order() re-checks.
export const revalidate = 60;

export async function generateStaticParams() {
  const { data, error } = await createPublicClient().from("products").select("slug");
  if (error) throw error;
  return data;
}

// Shared by generateMetadata and the page: one query per render. RLS = active products only.
const getProduct = cache(async (slug: string) => {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "name, description, care_instructions, size_guide, product_variants(id, color, size, price, original_price, stock), product_images(color, storage_path)",
    )
    .eq("slug", slug)
    .order("color", { referencedTable: "product_variants" })
    .order("sort_order", { referencedTable: "product_images" })
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { product_images, ...product } = data;
  return {
    ...product,
    images: product_images.map((i) => ({
      color: i.color,
      url: supabase.storage.from("product-images").getPublicUrl(i.storage_path).data.publicUrl,
    })),
  };
});

export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  return { title: product ? `${product.name} | Paranoidz` : "Not found | Paranoidz" };
}

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const product = await getProduct((await params).slug);
  if (!product) notFound();
  const sizeGuide = isSizeGuide(product.size_guide) ? product.size_guide : null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-6">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Product", href: "/products" }, { label: product.name }]} />
      <ProductView
        name={product.name}
        variants={product.product_variants}
        images={product.images}
        details={
          (product.description || product.care_instructions) && (
            <div className="flex flex-col gap-8">
              {product.description && (
                <div className="flex flex-col gap-4">
                  <h2 className="text-nav font-bold uppercase">Description</h2>
                  <p className="text-text-secondary">{product.description}</p>
                </div>
              )}
              {product.care_instructions && (
                <div className="flex flex-col gap-4">
                  <h2 className="text-nav font-bold uppercase">Care instructions</h2>
                  <p className="text-text-secondary">{product.care_instructions}</p>
                </div>
              )}
            </div>
          )
        }
        sizeGuide={sizeGuide && <SizeGuide guide={sizeGuide} />}
      />
    </div>
  );
}
