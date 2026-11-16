import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Fitness",
        short_name: "Fitness",
        description: "Offline fitness coach (PWA)",
        theme_color: "#24456b",
        background_color: "#f4f3ef",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "pwa-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,json}"],
        globIgnores: ["**/models/**"],
        navigateFallback: "index.html",
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith("/models/") &&
              !url.pathname.endsWith("/manifest.json"),
            handler: "CacheFirst",
            options: {
              cacheName: "fitness-pose-v1",
              expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    include: ["test/**/*.test.ts"],
  },
});