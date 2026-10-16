import Image from "next/image";
import Link from "next/link";

// Brand logo (2026-10-16): PARANOIDZ wordmark from Tủn's Drive, replaces the text
// wordmark everywhere. Dark on light backgrounds, white on dark. Favicon is separate.
export function Logo({ dark = false, className = "" }: { dark?: boolean; className?: string }) {
  return (
    <Link href="/" aria-label="Paranoidz — trang chủ" className={`inline-flex items-center ${className}`}>
      <Image
        src={dark ? "/home/logo-paranoidz-light.png" : "/home/logo-paranoidz-dark.png"}
        alt="Paranoidz"
        width={1985}
        height={320}
        className="h-8 w-auto lg:h-9"
        priority
      />
    </Link>
  );
}
