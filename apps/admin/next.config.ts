import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @paranoidz/db ships TypeScript source, not a build.
  transpilePackages: ["@paranoidz/db"],
  images: {
    // Same Vercel transformation quota as the storefront (shared team) — serve
    // Supabase originals directly. See the storefront config for the full note.
    unoptimized: true,
    // Public Storage objects only (product-images, review-images buckets).
    remotePatterns: [new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/**`)],
  },
};

export default nextConfig;
