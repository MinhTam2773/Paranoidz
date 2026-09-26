import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createClient } from "@paranoidz/db/server";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ProductView } from "@/components/product/ProductView";
import { SizeGuide, isSizeGuide } from "@/components/product/SizeGuide";

// Shared by generateMetadata and the page: one query per request. RLS = active products only.
const getProduct = cache(async (slug: string) => {
  const supabase = await createClient();
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
        hasSizeGuide={sizeGuide !== null}
      >
        {(product.description || product.care_instructions) && (
          <div className="flex flex-col gap-4 border-t border-border pt-6 text-text-secondary">
            {product.description && <p>{product.description}</p>}
            {product.care_instructions && (
              <p>
                <span className="text-nav uppercase text-text-primary">Care: </span>
                {product.care_instructions}
              </p>
            )}
          </div>
        )}
      </ProductView>

      {sizeGuide && (
        <section id="size-guide" className="mt-16 scroll-mt-36">
          <h2 className="mb-6 text-h3 uppercase">Size guide</h2>
          <SizeGuide guide={sizeGuide} />
        </section>
      )}
    </div>
  );
}
