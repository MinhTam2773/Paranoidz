"use client";

import Image from "next/image";
import Link from "next/link";

// Homepage v2 2026-10-16: full-viewport photo hero. (We tried the shop's
// TikTok clip as a video hero first, but every clip has burned-in lyric
// text and is only 720p — blurry and cluttered at fullscreen. The clips
// live in the "Ngoài đời thật" section instead, where vertical TikTok
// framing is native.)
export function PhotoHero() {
  return (
    <section className="relative flex min-h-[92svh] flex-col overflow-hidden bg-bg-dark text-text-on-dark">
      <Image
        src="/home/look-1.jpg"
        alt="Người mẫu mặc áo thun Paranoidz"
        fill
        preload
        sizes="100vw"
        className="object-cover object-[50%_20%]"
      />
      <div className="absolute inset-0 bg-linear-to-t from-bg-dark/70 via-transparent to-bg-dark/20" />
      <div className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col justify-between px-4 pb-8 pt-6 lg:px-6 lg:pb-12">
        <div className="flex items-center justify-between text-caption uppercase tracking-[0.14em] opacity-80">
          <span>BST 2026</span>
          <span className="hidden sm:inline">Streetwear — Việt Nam</span>
        </div>
        <div>
          <h1 className="font-logo text-display uppercase italic leading-[0.9] drop-shadow-lg">Paranoidz</h1>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link
              href="/products"
              className="flex h-12 items-center justify-center bg-accent px-8 text-button uppercase text-text-on-dark transition-colors duration-200 hover:bg-accent-hover"
            >
              Mua ngay
            </Link>
            <Link href="/products" className="text-button uppercase text-text-on-dark/80 underline underline-offset-8 hover:text-text-on-dark">
              Xem tất cả sản phẩm
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
