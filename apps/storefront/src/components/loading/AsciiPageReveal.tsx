"use client";

import { AsciiReveal } from "ascii-reveal";
import type { ReactNode } from "react";

// Decode-in wrapper for page content. Used together with app/loading.tsx:
// while the segment loads, the ASCII skeleton shimmers; when the real
// content mounts, it decodes into place (fast, ~400 ms to readable).
export function AsciiPageReveal({ children }: { children: ReactNode }) {
  return (
    <AsciiReveal preset="decode" duration="fast">
      {children}
    </AsciiReveal>
  );
}
