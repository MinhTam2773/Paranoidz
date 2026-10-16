"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

type Slide =
  | { type: "image"; src: string; alt: string }
  | { type: "video"; src: string; alt: string };

// Hero carousel 2026-10-16: 5 slides, all 16:9 — Tủn's product shots.
const SLIDES: Slide[] = [
  { type: "image", src: "/home/slide-duck.jpg", alt: "Họa tiết vịt thêu trên vải be" },
  { type: "image", src: "/home/slide-eagle.jpg", alt: "Họa tiết đại bàng thêu 3 màu" },
  { type: "image", src: "/home/slide-polo.jpg", alt: "Áo polo trắng thêu đại bàng" },
  { type: "image", src: "/home/slide-sweatshirt.jpg", alt: "Áo nỉ be thêu logo pdz" },
  { type: "image", src: "/home/slide-minimalism.jpg", alt: "Áo nỉ thêu minimalism" },
];

const AUTOPLAY_MS = 6000;

export function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const go = useCallback(
    (dir: 1 | -1) => setIndex((i) => (i + dir + SLIDES.length) % SLIDES.length),
    []
  );

  // Autoplay
  useEffect(() => {
    if (paused) return;
    timer.current = setInterval(() => go(1), AUTOPLAY_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [paused, go, index]);

  // Play the active video slide, pause the rest
  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === index) {
        v.currentTime = 0;
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    });
  }, [index]);

  return (
    <section
      aria-label="Paranoidz nổi bật"
      aria-roledescription="carousel"
      className="relative aspect-video w-full overflow-hidden bg-bg-dark"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {SLIDES.map((slide, i) => (
        <div
          key={slide.src}
          aria-hidden={i !== index}
          className={`absolute inset-0 transition-opacity duration-700 ${
            i === index ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          {slide.type === "image" ? (
            <Image
              src={slide.src}
              alt={slide.alt}
              fill
              sizes="100vw"
              priority={i === 0}
              className="object-cover"
            />
          ) : (
            <video
              ref={(el) => {
                videoRefs.current[i] = el;
              }}
              className="absolute inset-0 h-full w-full object-cover"
              src={slide.src}
              muted
              loop
              playsInline
              preload={i === 0 ? "auto" : "metadata"}
              aria-label={slide.alt}
            />
          )}
        </div>
      ))}

      {/* Arrows */}
      <button
        type="button"
        onClick={() => go(-1)}
        aria-label="Slide trước"
        className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-bg-dark/50 text-text-on-dark backdrop-blur transition hover:bg-bg-dark/80"
      >
        ‹
      </button>
      <button
        type="button"
        onClick={() => go(1)}
        aria-label="Slide tiếp"
        className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-bg-dark/50 text-text-on-dark backdrop-blur transition hover:bg-bg-dark/80"
      >
        ›
      </button>

      {/* Dots */}
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2">
        {SLIDES.map((s, i) => (
          <button
            key={s.src}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Tới slide ${i + 1}`}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === index ? "w-6 bg-accent" : "w-2 bg-text-on-dark/50 hover:bg-text-on-dark/80"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
