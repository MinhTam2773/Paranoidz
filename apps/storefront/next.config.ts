import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @paranoidz/db ships TypeScript source, not a build.
  transpilePackages: ["@paranoidz/db"],
  env: {
    // "production" only on the live site (tracking pixels, Sentry environment). Vercel sets
    // VERCEL_ENV itself; on Cloudflare it is the NEXT_PUBLIC_DEPLOY_ENV build variable.
    NEXT_PUBLIC_DEPLOY_ENV: process.env.NEXT_PUBLIC_DEPLOY_ENV ?? process.env.VERCEL_ENV ?? "development",
  },
  images: {
    // Vercel free team exhausted its 5,000 image transformations (optimised
    // images answer 402 OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED) — serve the
    // already-compressed Supabase originals directly until a different image
    // pipeline is chosen. Re-enable optimisation by deleting this line.
    unoptimized: true,
    // Public Storage objects only (product-images bucket).
    remotePatterns: [
      new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/**`),
      // Cloudflare R2 in production (@paranoidz/db/media).
      ...(process.env.NEXT_PUBLIC_MEDIA_URL ? [new URL(`${process.env.NEXT_PUBLIC_MEDIA_URL}/**`)] : []),
    ],
  },
};

export default nextConfig;
