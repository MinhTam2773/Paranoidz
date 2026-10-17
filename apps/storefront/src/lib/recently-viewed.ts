// Recently viewed products, tracked in localStorage (no account needed).
// The product page records each view; <RecentlyViewed> renders the rail.

const KEY = "pdz_recently_viewed";
const MAX = 10;

export function recordView(productId: string) {
  if (typeof window === "undefined" || !productId) return;
  try {
    const raw = window.localStorage.getItem(KEY);
    const ids = (raw ? (JSON.parse(raw) as string[]) : []).filter((id) => id !== productId);
    ids.unshift(productId);
    window.localStorage.setItem(KEY, JSON.stringify(ids.slice(0, MAX)));
  } catch {
    /* storage unavailable — skip silently */
  }
}

export function getRecentIds(excludeId?: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const ids = raw ? (JSON.parse(raw) as string[]) : [];
    return ids.filter((id) => id !== excludeId).slice(0, 8);
  } catch {
    return [];
  }
}
