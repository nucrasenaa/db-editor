import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use static export only for Electron production builds
  output: process.env.EXPORT_MODE === 'true' ? 'export' : undefined,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
