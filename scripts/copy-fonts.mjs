// Copies Excalidraw's bundled fonts into public/fonts so the app works offline
// (otherwise the package fetches them from a CDN at runtime).
import { cpSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules/@excalidraw/excalidraw/dist/prod/fonts");
const dest = join(root, "public/fonts");
if (!existsSync(src)) {
  console.error("Excalidraw fonts not found — run npm install first.");
  process.exit(1);
}
cpSync(src, dest, { recursive: true });
console.log("Copied Excalidraw fonts to public/fonts");
