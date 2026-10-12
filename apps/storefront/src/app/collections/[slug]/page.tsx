import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createPublicClient } from "@paranoidz/db/public";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ProductGrid } from "@/components/product/ProductGrid";
import { productCardQuery, toProductCard } from "@/lib/catalog";

// A collection set up in the admin (/collections there). ISR like product pages:
// prebuilt at deploy, rebuilt at most once a minute; new slugs render on first visit.
// UI in Vietnamese (CLAUDE.md §5) though older storefront pages are still English.
export const revalidate = 60;

export async function generateStaticParams() {
  const { data, error } = await createPublicClient().from("collections").select("slug");
  if (error) throw error;
  return data;
}

// RLS: active collections only, and items only of active collections; products
// only active ones — a hidden product simply drops out of the grid.
const getCollection = cache(async (slug: string) => {
  const supabase = createPublicClient();
  const { data: collection, error } = await supabase
    .from("collections")
    .select("name, description, collection_items(product_id, sort_order)")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!collection) return null;

  const order = new Map(collection.collection_items.map((i) => [i.product_id, i.sort_order]));
  const ids = [...order.keys()];
  if (!ids.length) return { name: collection.name, description: collection.description, cards: [] };
  const { data: products, error: productsError } = await productCardQuery(supabase).in("id", ids);
  if (productsError) throw productsError;
  const cards = products
    .toSorted((a, b) => order.get(a.id)! - order.get(b.id)!)
    .map((p) => toProductCard(supabase, p));
  return { name: collection.name, description: collection.description, cards };
});

export async function generateMetadata({ params }: PageProps<"/collections/[slug]">): Promise<Metadata> {
  const collection = await getCollection((await params).slug);
  return { title: collection ? `${collection.name} | Paranoidz` : "Không tìm thấy | Paranoidz" };
}

export default async function CollectionPage({ params }: PageProps<"/collections/[slug]">) {
  const collection = await getCollection((await params).slug);
  if (!collection) notFound();

  const heading = (
    <>
      <h1 className="text-h2 uppercase">{collection.name}</h1>
      {collection.description && <p className="mt-2 max-w-xl text-body text-text-secondary">{collection.description}</p>}
    </>
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-6">
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: collection.name }]} />
      {collection.cards.length ? (
        <ProductGrid cards={collection.cards}>{heading}</ProductGrid>
      ) : (
        <>
          <div className="mb-6">{heading}</div>
          <p className="text-text-secondary">
            Bộ sưu tập này chưa có sản phẩm.{" "}
            <Link href="/products" className="text-text-primary underline underline-offset-4 hover:text-accent">Xem tất cả sản phẩm</Link>
          </p>
        </>
      )}
    </div>
  );
}
