import Image from "next/image";

// Homepage v2 2026-10-16: big marquee band (Hydra-style) + lookbook grid
// with the shop's real-life photos from Drive.

const MARQUEE_ITEMS = ["Paranoidz", "Streetwear Việt Nam", "BST 2026", "Back to Basicz"];

export function Marquee() {
  const row = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  return (
    <div className="overflow-hidden border-y border-border bg-bg-dark py-5 text-text-on-dark" aria-hidden>
      <div className="flex w-max animate-ticker items-center">
        {[0, 1].map((half) => (
          <div key={half} className="flex w-max items-center">
            {row.map((item, i) => (
              <span key={`${half}-${i}`} className="flex items-center">
                <span className="px-8 font-logo text-h1 uppercase italic">{item}</span>
                <span className="text-accent text-h2">✦</span>
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
          Ngoài đời thật
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
