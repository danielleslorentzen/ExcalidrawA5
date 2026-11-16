// Sets Excalidraw's three stroke-width presets (thin / bold / extra bold) to the
// finer values in src/strokeWidths.json. Excalidraw has no option for this, so
// we rewrite the constant in the installed package (dev and prod builds).
//
// Runs on `npm install`, `npm run dev` and `npm run build`. It is idempotent,
// and it fails loudly if the constant can't be found, e.g. after upgrading
// @excalidraw/excalidraw, so a silent regression to thick strokes can't happen.
import { readFileSync, writeFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "node_modules/@excalidraw/excalidraw/dist");
const { thin, bold, extraBold } = JSON.parse(readFileSync(join(root, "src/strokeWidths.json"), "utf8"));

// Matches both `thin: 1,\n  bold: 2,\n  extraBold: 4` (dev) and `thin:1,bold:2,extraBold:4` (prod),
// and any values a previous run of this script wrote.
const pattern = /thin:(\s*)[\d.]+,(\s*)bold:(\s*)[\d.]+,(\s*)extraBold:(\s*)[\d.]+/g;

if (!existsSync(dist)) {
  console.error("patch-excalidraw: @excalidraw/excalidraw is not installed.");
  process.exit(1);
}

let changed = false;
for (const build of ["dev", "prod"]) {
  const dir = join(dist, build);
  const hits = readdirSync(dir)
    .filter((f) => f.endsWith(".js"))
    .map((f) => join(dir, f))
    .filter((file) => (readFileSync(file, "utf8").match(pattern) ?? []).length > 0);
  if (hits.length !== 1) {
    console.error(`patch-excalidraw: expected the STROKE_WIDTH constant in exactly one ${build} file, found ${hits.length}. Has @excalidraw/excalidraw changed? Update scripts/patch-excalidraw.mjs.`);
    process.exit(1);
  }
  const file = hits[0];
  const src = readFileSync(file, "utf8");
  if ((src.match(pattern) ?? []).length !== 1) {
    console.error(`patch-excalidraw: STROKE_WIDTH pattern is ambiguous in ${file}.`);
    process.exit(1);
  }
  const out = src.replace(pattern, (_m, a, b, c, d, e) => `thin:${a}${thin},${b}bold:${c}${bold},${d}extraBold:${e}${extraBold}`);
  if (out !== src) {
    writeFileSync(file, out);
    changed = true;
  }
}

// Vite pre-bundles dependencies; drop that cache so the dev server sees the patch.
if (changed) rmSync(join(root, "node_modules/.vite"), { recursive: true, force: true });
console.log(`patch-excalidraw: stroke widths ${thin} / ${bold} / ${extraBold}${changed ? " (applied)" : " (already applied)"}`);
