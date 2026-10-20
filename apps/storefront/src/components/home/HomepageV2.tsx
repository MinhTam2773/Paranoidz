import Image from "next/image";

// Homepage v2 2026-10-16: big marquee band (Hydra-style) + lookbook grid
// with the shop's real-life photos from Drive.

const MARQUEE_ITEMS = ["Paranoidz", "Streetwear Việt Nam", "BST 2026", "Back to Basicz"];

export function Marquee() {
  const row = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  return (
    // Slim band (owner 2026-10-20): 34px tall, matching the top announcement ticker.
    <div className="flex h-[34px] items-center overflow-hidden border-y border-border bg-bg-dark text-text-on-dark" aria-hidden>
      <div className="flex w-max animate-ticker items-center">
        {[0, 1].map((half) => (
          <div key={half} className="flex w-max items-center">
            {row.map((item, i) => (
              <span key={`${half}-${i}`} className="flex items-center">
                <span className="px-6 font-logo text-[15px] uppercase italic leading-none">{item}</span>
                <span className="text-[13px] text-accent">✦</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const LOOKS = [
  { src: "/home/look-1.jpg", alt: "Áo thun Paranoidz màu be phối quần jeans" },
  { src: "/home/look-2.jpg", alt: "Áo thun Paranoidz chụp ngoài phố" },
  { src: "/home/look-3.jpg", alt: "Áo thun Paranoidz dưới giàn hoa giấy" },
  { src: "/home/look-4.jpg", alt: "Áo thun Paranoidz màu xám ngồi quán cà phê" },
  { src: "/home/look-5.jpg", alt: "Áo thun đen Paranoidz" },
  { src: "/home/look-6.jpg", alt: "Áo polo trắng Paranoidz" },
  // Customer review photos from Shopee (collected 2026-10-20) — real buyers
  // wearing the products, not flat-lays.
  { src: "/home/look-7.jpg", alt: "Khách mặc áo thun pdz01 màu xanh mint chụp gương" },
  { src: "/home/look-8.jpg", alt: "Khách mặc áo thun pdz01 màu xám phối mũ lưỡi trai" },
  { src: "/home/look-9.jpg", alt: "Khách mặc áo thun pdz01 màu xám chụp gương" },
  { src: "/home/look-10.jpg", alt: "Khách mặc áo thun pdz01 màu xám, cận cảnh chất vải" },
  { src: "/home/look-11.jpg", alt: "Khách mặc áo thun đen pdz04 dập nổi ngoài phố" },
  { src: "/home/look-12.jpg", alt: "Khách mặc áo thun đen pdz04 chụp gương" },
  { src: "/home/look-13.jpg", alt: "Khách mặc áo thun đen pdz04 phối quần short" },
  { src: "/home/look-14.jpg", alt: "Khách mặc áo thun đen pdz04 ngoài trời" },
  { src: "/home/look-15.jpg", alt: "Khách mặc áo thun đen pdz04 ngồi ghế gỗ ngoài trời" },
  { src: "/home/look-16.jpg", alt: "Khách mặc áo polo pdz06 màu trắng kem" },
  { src: "/home/look-17.jpg", alt: "Khách mặc áo polo pdz06 màu nâu phối quần short" },
  { src: "/home/look-18.jpg", alt: "Khách mặc áo polo pdz06 màu nâu" },
  { src: "/home/look-19.jpg", alt: "Khách mặc áo polo pdz06 màu nâu phối quần sáng màu" },
];

// Vertical TikTok clips — native 9:16, text overlays are fine here because
// this is UGC, not the brand hero.
const CLIPS = [
  { src: "/home/pdz3-web.mp4", label: "Phố cổ" },
  { src: "/home/pdz4-web.mp4", label: "Biển" },
];

export function Lookbook() {
  return (
    <section aria-label="Paranoidz ngoài đời">
      <div className="mb-8 flex items-end justify-between border-b border-border pb-4">
        <h2 className="text-h2 uppercase">
          <span className="mr-3 text-accent">✦</span>
          Đời thực
        </h2>
        <span className="shrink-0 text-nav uppercase text-text-secondary">Khách mặc Paranoidz</span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-5">
        {LOOKS.map((look) => (
          <div key={look.src} className="relative aspect-square overflow-hidden rounded-sm bg-bg-secondary">
            <Image
              src={look.src}
              alt={look.alt}
              fill
              sizes="(min-width: 1024px) 20vw, 33vw"
              className="object-cover transition-transform duration-300 hover:scale-[1.03]"
              loading="lazy"
            />
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 sm:mt-3 sm:gap-3 lg:grid-cols-5">
        {CLIPS.map((clip) => (
          <div key={clip.src} className="relative aspect-square overflow-hidden rounded-sm bg-bg-dark">
            <video
              className="absolute inset-0 h-full w-full object-cover"
              src={clip.src}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-label={`Video ${clip.label}`}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
