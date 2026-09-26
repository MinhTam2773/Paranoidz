import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @paranoidz/db ships TypeScript source, not a build.
  transpilePackages: ["@paranoidz/db"],
};

export default nextConfig;
