import Image from "next/image";
import Link from "next/link";
import { createPublicClient } from "@paranoidz/db/public";
import { formatVnd } from "@/lib/format";

type Offer = {
  id: string;
  name: string;
  discount: number;
  products: { id: string; name: string; slug: string; price: number; imageUrl: string | null }[];
};

// Active bundles containing this product (ARCHITECTURE.md §5), for the product page.
// RLS: active bundles only, active products only. A bundle with a hidden or sold-out product
// can't be completed, so it's left out. Prices = cheapest in-stock variant (display only).
export async function getBundleOffers(productId: string): Promise<Offer[]> {
  const supabase = createPublicClient();
  const { data: links, error: linksError } = await supabase.from("bundle_items").select("bundle_id").eq("product_id", productId);
  if (linksError) throw linksError;
  if (!links.length) return [];

  const { data, error } = await supabase
    .from("bundles")
    .select("id, name, discount_amount, bundle_items(product_id, products(id, name, slug, product_variants(price, stock), product_images(storage_path, sort_order)))")
    .in("id", links.map((l) => l.bundle_id))
    .order("discount_amount", { ascending: false });
  if (error) throw error;

  return data.flatMap((b) => {
    const products = b.bundle_items.map((i) => {
      const p = i.products;
      const inStock = p?.product_variants.filter((v) => v.stock > 0) ?? [];
      if (!p || !inStock.length) return null;
      const image = p.product_images.toSorted((a, c) => a.sort_order - c.sort_order)[0];
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: Math.min(...inStock.map((v) => v.price)),
        imageUrl: image ? supabase.storage.from("product-images").getPublicUrl(image.storage_path).data.publicUrl : null,
      };
    });
    if (products.some((p) => p === null)) return [];
    // This product first, the rest in a stable order.
    const sorted = (products as Offer["products"]).toSorted((a, c) => Number(c.id === productId) - Number(a.id === productId) || a.name.localeCompare(c.name));
    return [{ id: b.id, name: b.name, discount: b.discount_amount, products: sorted }];
  });
}

// Stitch "Product Detail Page (with Bundle)", minus its ADD BUNDLE TO CART button: every product
// needs its own size/colour, so each one links to its page and the discount applies at checkout.
export function BundleOffers({ offers }: { offers: Offer[] }) {
  if (!offers.length) return null;
  return (
    <section aria-labelledby="bundles-title" className="mt-16 flex flex-col gap-6 border-t border-border pt-8">
      <h2 id="bundles-title" className="text-h3 uppercase">Mua theo combo</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {offers.map((o) => {
          const combined = o.products.reduce((sum, p) => sum + p.price, 0);
          return (
            <div key={o.id} className="flex flex-col gap-5 rounded-sm border border-border p-4 lg:p-6">
              <p className="text-product-name font-semibold uppercase wrap-break-word">{o.name}</p>
              <ul className="grid auto-cols-fr grid-flow-col gap-6">
                {o.products.map((p, i) => (
                  <li key={p.id} className="min-w-0">
                    <Link href={`/products/${p.slug}`} className="group flex flex-col gap-2">
                      <span className="relative">
                        <span className="relative block aspect-3/4 overflow-hidden rounded-sm bg-bg-secondary">
                          {p.imageUrl && (
                            <Image src={p.imageUrl} alt="" fill sizes="(min-width: 1024px) 180px, 30vw" className="object-cover transition-transform duration-300 group-hover:scale-105" />
                          )}
                        </span>
                        {i > 0 && <span aria-hidden="true" className="absolute top-1/2 -left-6 flex w-6 -translate-y-1/2 justify-center text-h3 text-text-muted">+</span>}
                      </span>
                      <span className="line-clamp-2 text-caption uppercase text-text-primary group-hover:underline">{p.name}</span>
                      <span className="text-caption text-text-secondary">{formatVnd(p.price)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-2">
                <p className="flex flex-wrap items-baseline gap-x-3">
                  <span className="text-nav uppercase text-text-secondary">Giá combo</span>
                  <span className="text-price text-accent">{formatVnd(Math.max(combined - o.discount, 0))}</span>
                  <s className="text-price-old text-text-muted">{formatVnd(combined)}</s>
                </p>
                <p className="text-caption text-text-secondary">
                  Thêm đủ các sản phẩm vào giỏ (size, màu tùy chọn) — giảm {formatVnd(o.discount)} cho mỗi bộ khi đặt hàng. Không cộng dồn với mã giảm giá: bạn được mức giảm cao hơn.
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
