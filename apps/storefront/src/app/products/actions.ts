"use server";

import { createPublicClient } from "@paranoidz/db/public";
import { productCardQuery, toProductCard } from "@/lib/catalog";

// Card data for a list of product ids, in the given order. Used by RecentlyViewed.
export async function getProductsByIds(ids: string[]) {
  const clean = [...new Set(ids)].filter(Boolean).slice(0, 10);
  if (!clean.length) return [];
  const supabase = createPublicClient();
  const { data: rows, error } = await productCardQuery(supabase).in("id", clean).eq("is_active", true);
  if (error) throw error;
  const rank = new Map(clean.map((id, i) => [id, i]));
  return (rows ?? [])
    .toSorted((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
    .map((p) => toProductCard(supabase, p));
}
