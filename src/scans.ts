import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { BinaryFileData, DataURL } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement, FileId } from "@excalidraw/excalidraw/element/types";
import type { Orientation, PageContent } from "./types";
import { pagePixelSize, pageSize, randomId } from "./page";

export interface ScanImage {
  dataURL: string;
  width: number;
  height: number;
}

/** Long edge of an A5 page at 300 DPI. Larger scans are downscaled to this. */
const MAX_EDGE = pagePixelSize("portrait").height;

function canvasToScan(source: CanvasImageSource, w: number, h: number): ScanImage {
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  const width = Math.round(w * scale);
  const height = Math.round(h * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);
  return { dataURL: canvas.toDataURL("image/jpeg", 0.88), width, height };
}

async function imageFileToScan(file: File): Promise<ScanImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    return canvasToScan(bitmap, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

async function pdfFileToScans(file: File): Promise<ScanImage[]> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  const out: ScanImage[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: MAX_EDGE / Math.max(base.width, base.height) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvas, viewport }).promise;
    out.push(canvasToScan(canvas, canvas.width, canvas.height));
    page.cleanup();
  }
  await task.destroy();
  return out;
}

/** Turns picked files (photos, scanner images, multi-page PDFs) into page images. */
export async function filesToScans(files: File[]): Promise<ScanImage[]> {
  const out: ScanImage[] = [];
  for (const file of files) {
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      out.push(...(await pdfFileToScans(file)));
    } else if (file.type.startsWith("image/")) {
      out.push(await imageFileToScan(file));
    }
  }
  return out;
}

export const orientationFor = (scan: ScanImage): Orientation =>
  scan.width > scan.height ? "landscape" : "portrait";

/**
 * Places a scan as a locked background image filling the page. Scans whose
 * aspect ratio is within 4% of A5 are stretched to the exact page edges, so a
 * scanned A5 sheet lines up 1:1 with the printed page.
 */
export function scanToElement(scan: ScanImage, orientation: Orientation): {
  element: ExcalidrawElement;
  file: BinaryFileData;
} {
  const page = pageSize(orientation);
  const pageAspect = page.width / page.height;
  const aspect = scan.width / scan.height;
  let width = page.width;
  let height = page.height;
  if (Math.abs(aspect - pageAspect) / pageAspect > 0.04) {
    if (aspect > pageAspect) height = page.width / aspect;
    else width = page.height * aspect;
  }
  const fileId = randomId() as FileId;
  const [element] = convertToExcalidrawElements([
    {
      type: "image",
      fileId,
      x: (page.width - width) / 2,
      y: (page.height - height) / 2,
      width,
      height,
      locked: true,
    },
  ]);
  return {
    element: { ...element, status: "saved" } as ExcalidrawElement,
    file: { id: fileId, mimeType: "image/jpeg", dataURL: scan.dataURL as DataURL, created: Date.now() },
  };
}

export function contentFromScan(scan: ScanImage, orientation: Orientation): PageContent {
  const { element, file } = scanToElement(scan, orientation);
  return { elements: [element], files: { [file.id]: file } };
}
