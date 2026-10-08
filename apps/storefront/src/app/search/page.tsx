import type { Metadata } from "next";
import Link from "next/link";
import { createPublicClient } from "@paranoidz/db/public";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { SearchForm } from "@/components/layout/SearchForm";
import { ProductCard } from "@/components/product/ProductCard";
import { searchProductCards } from "@/lib/catalog";

export const metadata: Metadata = { title: "Tìm kiếm | Paranoidz", robots: { index: false } };

// Product search (ARCHITECTURE.md §2.2): search_products() ranks active products by name,
// category, colour and description, accent-insensitive; cards come from the catalog query.
export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const { q } = await searchParams;
  const query = (typeof q === "string" ? q : "").trim().slice(0, 100);

  const cards = query ? await searchProductCards(createPublicClient(), query) : [];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-6">
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, { label: "Tìm kiếm" }]} />
      <h1 className="mb-6 text-h2 uppercase">Tìm kiếm</h1>
      <div className="mb-8 max-w-xl">
        <SearchForm key={query} defaultValue={query} />
      </div>

      {!query ? (
        <p className="text-text-secondary">Tìm theo tên sản phẩm, danh mục hoặc màu sắc.</p>
      ) : cards.length ? (
        <>
          <p className="mb-4 wrap-break-word text-text-secondary">
            {cards.length} kết quả cho &ldquo;<span className="text-text-primary">{query}</span>&rdquo;
          </p>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {cards.map((card, i) => (
              <ProductCard key={card.slug} product={card} eager={i < 3} />
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-start gap-6">
          <p className="max-w-full wrap-break-word text-text-secondary">
            Không có sản phẩm nào khớp với &ldquo;<span className="text-text-primary">{query}</span>&rdquo;. Hãy thử ít từ hơn hoặc từ khác.
          </p>
          <Link
            href="/products"
            className="flex h-12 w-full max-w-xs items-center justify-center rounded-sm border border-text-primary text-button uppercase text-text-primary transition-colors duration-200 hover:bg-text-primary hover:text-text-on-dark"
          >
            Xem tất cả sản phẩm
          </Link>
        </div>
      )}
    </div>
  );
}
