import { createPublicClient } from "@paranoidz/db/public";
import { SITE_URL } from "@/lib/site";

// Product feed for the Meta catalog that Advantage+ catalog ads draw from (Commerce Manager →
// catalog → data source → scheduled feed, https://paranoidz.vn/meta-feed.xml, daily). One item per
// variant, id = variant id as the pixel's AddToCart / InitiateCheckout / Purchase send it, grouped
// by item_group_id = product id as ViewContent sends it. RLS returns active products only, like the
// product pages; a variant whose product has no photo is left out (Meta rejects items without one).
export const revalidate = 3600;

const xml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Rich-text description → plain text (tags out, the entities the editor writes decoded).
const plain = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

export async function GET() {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, slug, description, product_variants(id, color, size, price, original_price, stock), product_images(color, storage_path)")
    .order("sort_order", { referencedTable: "product_images" });
  if (error) throw error;

  const items = data.flatMap((p) => {
    const description = plain(p.description ?? "") || p.name;
    return p.product_variants.flatMap((v) => {
      const image = p.product_images.find((i) => i.color === v.color) ?? p.product_images[0];
      if (!image) return [];
      const onSale = v.original_price != null && v.original_price > v.price;
      const fields = [
        ["g:id", v.id],
        ["g:item_group_id", p.id],
        ["g:title", p.name.slice(0, 150)],
        ["g:description", description.slice(0, 5000)],
        ["g:link", `${SITE_URL}/products/${p.slug}`],
        ["g:image_link", supabase.storage.from("product-images").getPublicUrl(image.storage_path).data.publicUrl],
        ["g:brand", "Paranoidz"],
        ["g:condition", "new"],
        ["g:availability", v.stock > 0 ? "in stock" : "out of stock"],
        ["g:price", `${onSale ? v.original_price : v.price} VND`],
        ...(onSale ? [["g:sale_price", `${v.price} VND`]] : []),
        ["g:color", v.color],
        ["g:size", v.size],
      ];
      return [`<item>${fields.map(([tag, value]) => `<${tag}>${xml(String(value))}</${tag}>`).join("")}</item>`];
    });
  });

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>Paranoidz</title><link>${SITE_URL}</link><description>Paranoidz</description>
${items.join("\n")}
</channel></rss>`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
