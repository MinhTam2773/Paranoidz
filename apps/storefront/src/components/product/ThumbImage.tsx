"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { thumbPath, type ThumbWidth } from "@paranoidz/db/thumbs";

// A product photo from Storage shown small (2026-10-31: Storage egress over the free plan, and
// image optimisation is off — next.config.ts). Loads the admin-made thumbnail
// (@paranoidz/db/thumbs) and falls back to the original when it is missing.
export function ThumbImage({ src, thumb, alt, ...props }: Omit<ImageProps, "src"> & { src: string; thumb: ThumbWidth }) {
  const small = thumbPath(src, thumb);
  const [failed, setFailed] = useState<string | null>(null);
  return <Image {...props} alt={alt} src={failed === small ? src : small} onError={() => setFailed(small)} />;
}
