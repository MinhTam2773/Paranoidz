/** "pz-2026-0074", "PZ 2026 0074", "2026-0074" → "PZ-2026-0074" (place_order's format); else null. */
export function parseOrderNumber(raw: string) {
  const m = /^(?:PZ)?[\s-]*(\d{4})[\s-]*(\d{4,})$/i.exec(raw.trim());
  return m ? `PZ-${m[1]}-${m[2]}` : null;
}
