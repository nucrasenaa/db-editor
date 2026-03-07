import type { NextConfig } from "next";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require("next-pwa");

const nextConfig: NextConfig = {
  // Use static export only for Electron production builds
  output: process.env.EXPORT_MODE === 'true' ? 'export' : undefined,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // Acknowledge webpack config from next-pwa to suppress Turbopack conflict warning
  turbopack: {},
};

// Disable PWA when building for Electron (static export) or during development
const isElectronBuild = process.env.EXPORT_MODE === 'true';
const isDev = process.env.NODE_ENV === 'development';

export default withPWA({
  dest: 'public',
  disable: isElectronBuild || isDev,
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      // API routes: NEVER cache — always fetch fresh from server
      urlPattern: /^https?:\/\/.*\/api\/.*/i,
      handler: 'NetworkOnly',
    },
    {
      // Next.js static assets (JS, CSS, fonts)
      urlPattern: /^\/_next\/static\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'data-forge-next-static',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
        },
      },
    },
    {
      // Images and public assets
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|ico|webp)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'data-forge-images',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
        },
      },
    },
    {
      // HTML pages: network first, fallback to cache
      urlPattern: /^https?:\/\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'data-forge-pages',
        expiration: {
          maxEntries: 20,
          maxAgeSeconds: 60 * 60 * 24, // 1 day
        },
        networkTimeoutSeconds: 10,
      },
    },
  ],
})(nextConfig);
