import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages serves the app from /<repo-name>/. The deploy workflow passes
// BASE_PATH; locally we build for the default repo name.
export default defineConfig(({ command, isPreview }) => {
  const base = command === "build" || isPreview ? process.env.BASE_PATH || "/ExcalidrawA5/" : "/";
  return {
    base,
    define: {
      // Excalidraw reads process.env.IS_PREACT
      "process.env.IS_PREACT": JSON.stringify("false"),
    },
    build: { chunkSizeWarningLimit: 4000 },
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["icon.svg", "apple-touch-icon-180x180.png"],
        manifest: {
          name: "A5 Excalidraw",
          short_name: "A5 Notes",
          description: "Excalidraw locked to A5 pages, for a discbound paper notebook.",
          theme_color: "#ffffff",
          background_color: "#ffffff",
          // Installed app opens full screen (hides Android's status and navigation bars;
          // swipe from an edge to reveal them). Browsers without it fall back to standalone.
          display: "fullscreen",
          display_override: ["fullscreen", "standalone"],
          orientation: "any",
          start_url: base,
          scope: base,
          // Lets the installed app receive notebook backups: Android's share sheet
          // (handled by public/share-target.js) and desktop "Open with".
          share_target: {
            action: `${base}share-target`,
            method: "POST",
            enctype: "multipart/form-data",
            params: { files: [{ name: "file", accept: ["application/json", "text/json", ".json"] }] },
          },
          file_handlers: [{ action: base, accept: { "application/json": [".json"] } }],
          launch_handler: { client_mode: ["focus-existing", "auto"] },
          icons: [
            { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
            { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
            { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
        workbox: {
          importScripts: ["share-target.js"],
          globPatterns: ["**/*.{js,mjs,css,html,svg,png,woff2}"],
          // CJK font subsets are large and fetched on demand: cache at runtime instead.
          globIgnores: ["**/fonts/Xiaolai/**"],
          maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: /\/fonts\/Xiaolai\//,
              handler: "CacheFirst",
              options: { cacheName: "cjk-fonts", expiration: { maxEntries: 400 } },
            },
          ],
        },
      }),
    ],
  };
});
