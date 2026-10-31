// Product photo thumbnails (2026-10-31): Storage egress went over the free plan because cards
// and colour swatches downloaded the 1600 px originals (image optimisation is off, see the
// storefront's next.config.ts). The admin stores two smaller JPEGs next to every gallery photo;
// the storefront shows them and falls back to the original when one is missing.
//   products/{slug}/{uuid}.{jpg|png|webp} → products/{slug}/thumbs/{uuid}-{width}.jpg
// Works on a Storage path or its public URL. Anything else (e.g. dev seed images) comes back unchanged.
export const THUMB_WIDTHS = [600, 120] as const;
export type ThumbWidth = (typeof THUMB_WIDTHS)[number];

export function thumbPath(path: string, width: ThumbWidth) {
  return path.replace(/\/([0-9a-f-]{36})\.(jpg|png|webp)$/, `/thumbs/$1-${width}.jpg`);
}
