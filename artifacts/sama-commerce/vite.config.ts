import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : 3000;

const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "apple-touch-icon.svg"],
      manifest: {
        name: "LIMAPAY",
        short_name: "LIMAPAY",
        description: "Gestion commerciale pour commerces physiques au Sénégal",
        theme_color: "#2d6a4f",
        background_color: "#ffffff",
        display: "standalone",
        start_url: basePath,
        scope: basePath,
        orientation: "portrait-primary",
        categories: ["business", "finance", "productivity"],
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
          { src: "apple-touch-icon.svg", sizes: "180x180", type: "image/svg+xml" },
        ],
      },
      workbox: {
        // Cache API calls for offline resilience
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\/products/,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "api-products", expiration: { maxEntries: 1, maxAgeSeconds: 300 } },
          },
          {
            urlPattern: /^https?:\/\/.*\/api\/customers/,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "api-customers", expiration: { maxEntries: 1, maxAgeSeconds: 300 } },
          },
          {
            urlPattern: /^https?:\/\/api\.qrserver\.com/,
            handler: "CacheFirst",
            options: { cacheName: "qr-codes", expiration: { maxEntries: 50, maxAgeSeconds: 3600 } },
          },
        ],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//],
      },
      devOptions: { enabled: true, type: "module" },
    }),
    ...((process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined)
      ? [
          await import("@replit/vite-plugin-runtime-error-modal").then(m => m.default()),
          await import("@replit/vite-plugin-cartographer").then(m =>
            m.cartographer({ root: path.resolve(import.meta.dirname, "..") })
          ),
          await import("@replit/vite-plugin-dev-banner").then(m => m.devBanner()),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: { strict: true },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
