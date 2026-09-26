import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @paranoidz/db ships TypeScript source, not a build.
  transpilePackages: ["@paranoidz/db"],
  images: {
    // Public Storage objects only (product-images bucket).
    remotePatterns: [new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/**`)],
  },
};

export default nextConfig;
