# A5 Excalidraw

Excalidraw locked to A5 pages, built to work alongside an A5 discbound paper
notebook: scan paper pages in, draw on them, and print digital pages back out at
exactly A5.

It embeds the official [`@excalidraw/excalidraw`](https://www.npmjs.com/package/@excalidraw/excalidraw)
component, so the drawing tools, pen and touch support and keyboard shortcuts are
stock Excalidraw. Upgrading is a version bump.

## What's different from excalidraw.com

- **Every page is an A5 sheet.** The page is 148 × 210 mm (portrait or landscape) and you
  can't pan it out of view. Anything drawn past the edge is cropped on export.
- **Notebook organisation.** Sections work like tab dividers, each with its own colour.
  Pages show as thumbnails and you can search, rename, reorder, duplicate or move them
  between sections. Use ‹ › or Alt+PageUp / Alt+PageDown to flip pages.
- **Paper guides (on screen only).** You can show dot, lined or grid ruling, plus a
  shaded strip on the side where the discs go. None of it is printed.
- **Scan in.** Import photos, scanner images or multi-page PDFs. Each image becomes a
  locked background on its own page. Scans that are already A5-shaped are stretched to
  fit the page edges exactly, so a re-print lines up with the original. On a phone the
  picker can open the camera.
- **Print out.** Export an A5 PDF at 300 DPI, either one page or a whole section, or a
  300 DPI PNG. On phones and tablets the file goes to the share sheet. When printing,
  choose **Actual size / 100%**.
- **Offline PWA.** Fonts are self-hosted and everything is cached by a service worker,
  so you can install it to your home screen or desktop and it works without a network.

## Storage and backups

Pages are stored in the browser's IndexedDB, and the app asks the browser for persistent
storage. Each browser and device keeps its own separate notebook. Use **Menu → Back up
notebook** now and then. **Restore from backup** merges a backup into the current notebook
and can move a notebook to another device.

On iPhone/iPad, install the app to the home screen (Share → Add to Home Screen).
Safari can clear storage for sites that aren't installed.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run preview    # serve the build at http://localhost:4173/ExcalidrawA5/
```

## Deploying to GitHub Pages

1. Push this repo to GitHub.
2. In the repo, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main`. `.github/workflows/deploy.yml` builds and publishes to
   `https://<username>.github.io/<repo-name>/`.

The build's base path comes from the repository name. To serve from a custom domain
root later, set `BASE_PATH: /` in the workflow and add a `public/CNAME` file.

## Code map

| File | What it does |
| --- | --- |
| `src/App.tsx` | Hosts Excalidraw; handles page switching, autosave, menus, import/export, backups |
| `src/PageBackdrop.tsx` | Draws the A5 sheet, ruling and disc margin behind the transparent canvas, and keeps the page in view |
| `src/PagesPanel.tsx` | The Notebook sidebar (sections, thumbnails, search, page settings) |
| `src/exporting.ts` | Renders exactly the page area, then PDF / PNG / thumbnails |
| `src/scans.ts` | Turns images and PDFs into page-sized background images |
| `src/storage.ts` | IndexedDB persistence |
| `src/page.ts` | A5 geometry (scene units are 96 DPI CSS px; exports are 300 DPI) |
