"use client";

import { useEffect, useRef } from "react";

// Muted looping clip that downloads nothing until it is near the viewport, then plays
// while on screen. PageSpeed 2026-10-30: the lookbook's two autoplay clips (5.7 MB) were
// fetched on every homepage load although they sit far below the first screen.
export function InViewVideo({ src, label }: { src: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!video.src) video.src = src;
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [src]);

  return (
    <video
      ref={ref}
      className="absolute inset-0 h-full w-full object-cover"
      muted
      loop
      playsInline
      preload="none"
      aria-label={`Video ${label}`}
    />
  );
}
