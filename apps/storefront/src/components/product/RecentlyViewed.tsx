"use client";

import { useEffect, useState } from "react";
import { getRecentIds } from "@/lib/recently-viewed";
import { getProductsByIds } from "@/app/products/actions";
import { ProductCard, type ProductCardData } from "./ProductCard";

// "Sản phẩm đã xem gần đây" rail (Hydra-style). Reads product ids from localStorage,
// fetches their card data, and renders a grid. Hidden when there's nothing to show.
export function RecentlyViewed({ excludeId }: { excludeId: string }) {
  const [products, setProducts] = useState<ProductCardData[] | null>(null);

  useEffect(() => {
    const ids = getRecentIds(excludeId);
    if (!ids.length) {
      setProducts([]);
      return;
    }
    getProductsByIds(ids).then(setProducts).catch(() => setProducts([]));
  }, [excludeId]);

  if (!products || products.length === 0) return null;

  return (
    <section aria-labelledby="recently-viewed" className="mx-auto w-full max-w-7xl px-4 lg:px-6">
      <h2 id="recently-viewed" className="text-h2 mb-6 text-center">
        Sản phẩm đã xem gần đây
      </h2>
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
