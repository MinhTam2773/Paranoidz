import Image from "next/image";
import Link from "next/link";

// Brand logo (2026-10-16): flat 2D pdz logo, replaces the text wordmark everywhere.
// Transparent on light backgrounds, black-bg version on dark. Favicon is separate.
export function Logo({ dark = false, className = "" }: { dark?: boolean; className?: string }) {
  return (
    <Link href="/" aria-label="Paranoidz — trang chủ" className={`inline-flex items-center ${className}`}>
      <Image
        src={dark ? "/home/pdz-logo-2d.png" : "/home/pdz-logo-2d-transparent.png"}
        alt="Paranoidz"
        width={dark ? 44 : 120}
        height={dark ? 44 : 57}
        className={dark ? "size-11 object-cover" : "h-9 w-auto lg:h-10"}
        priority
      />
    </Link>
  );
}
