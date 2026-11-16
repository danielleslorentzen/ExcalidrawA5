import { exportToCanvas, convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { ExcalidrawFrameLikeElement } from "@excalidraw/excalidraw/element/types";
import type { PageContent, PageMeta } from "./types";
import { PRINT_SCALE, pageSize, pageSizeMm, safeFileName } from "./page";

/** Renders exactly the A5 page area (anything outside the page is cropped). */
export async function renderPage(content: PageContent, meta: PageMeta, scale: number) {
  const { width, height } = pageSize(meta.orientation);
  const [frame] = convertToExcalidrawElements([
    { type: "frame", x: 0, y: 0, width, height, children: [] },
  ]) as ExcalidrawFrameLikeElement[];
  const elements = content.elements.filter((el) => !el.isDeleted);
  return exportToCanvas({
    elements: [...elements, frame],
    files: content.files,
    exportingFrame: frame,
    appState: {
      exportBackground: true,
      viewBackgroundColor: "#ffffff",
      exportWithDarkMode: false,
      frameRendering: { enabled: true, name: false, outline: false, clip: false },
    },
    getDimensions: () => ({
      width: Math.round(width * scale),
      height: Math.round(height * scale),
      scale,
    }),
  });
}

/** Long edge of a thumbnail, in pixels. */
const THUMB_EDGE = 220;

export async function renderThumbnail(content: PageContent, meta: PageMeta) {
  const { width, height } = pageSize(meta.orientation);
  const canvas = await renderPage(content, meta, THUMB_EDGE / Math.max(width, height));
  return canvas.toDataURL("image/jpeg", 0.75);
}

const hasImages = (content: PageContent) =>
  content.elements.some((el) => el.type === "image" && !el.isDeleted);

/** Builds a multi-page A5 PDF at print resolution, one notebook page per PDF page. */
export async function buildPdf(pages: { meta: PageMeta; content: PageContent }[]) {
  const { jsPDF } = await import("jspdf");
  let pdf: InstanceType<typeof jsPDF> | null = null;
  for (const { meta, content } of pages) {
    const mm = pageSizeMm(meta.orientation);
    if (!pdf) {
      pdf = new jsPDF({ orientation: meta.orientation, unit: "mm", format: "a5", compress: true });
    } else {
      pdf.addPage("a5", meta.orientation);
    }
    const canvas = await renderPage(content, meta, PRINT_SCALE);
    // Photos/scans compress far better as JPEG; pure ink stays crisp as PNG.
    if (hasImages(content)) {
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.9), "JPEG", 0, 0, mm.width, mm.height);
    } else {
      pdf.addImage(canvas, "PNG", 0, 0, mm.width, mm.height, undefined, "FAST");
    }
  }
  if (!pdf) throw new Error("Nothing to export");
  return pdf.output("blob");
}

export async function buildPng(meta: PageMeta, content: PageContent) {
  const canvas = await renderPage(content, meta, PRINT_SCALE);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b: Blob | null) => (b ? resolve(b) : reject(new Error("PNG export failed"))), "image/png"),
  );
}

const isTouchDevice = () => window.matchMedia?.("(pointer: coarse)").matches;

/**
 * On phones/tablets, hands the file to the share sheet (Print, Files, Drive…);
 * on desktop, downloads it.
 */
export async function deliverFile(blob: Blob, baseName: string, ext: string) {
  const fileName = `${safeFileName(baseName)}.${ext}`;
  if (isTouchDevice() && navigator.canShare) {
    const file = new File([blob], fileName, { type: blob.type });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: fileName });
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
