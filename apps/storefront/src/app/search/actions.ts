"use server";

import { createPublicClient } from "@paranoidz/db/public";
import { searchProductCards } from "@/lib/catalog";

// Header search suggestions: the top 5 of the same ranked search as /search.
export async function searchSuggestions(query: string) {
  const q = String(query ?? "").trim().slice(0, 100);
  return q ? searchProductCards(createPublicClient(), q, 5) : [];
}
