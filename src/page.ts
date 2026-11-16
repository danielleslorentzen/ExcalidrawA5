import type { PageMeta, Orientation } from "./types";

/** Scene units are CSS pixels at 96 DPI, so 1 mm = 96 / 25.4 units. */
export const MM = 96 / 25.4;
export const A5_SHORT_MM = 148;
export const A5_LONG_MM = 210;
/** Print/export resolution. */
export const PRINT_DPI = 300;
export const PRINT_SCALE = PRINT_DPI / 96;
/** Width of the disc-binding margin guide. */
export const BINDING_MARGIN_MM = 12;

export const pageSizeMm = (orientation: Orientation) =>
  orientation === "portrait"
    ? { width: A5_SHORT_MM, height: A5_LONG_MM }
    : { width: A5_LONG_MM, height: A5_SHORT_MM };

/** Page size in scene units. The page always sits at scene origin (0, 0). */
export const pageSize = (orientation: Orientation) => {
  const mm = pageSizeMm(orientation);
  return { width: mm.width * MM, height: mm.height * MM };
};

export const pagePixelSize = (orientation: Orientation) => {
  const { width, height } = pageSize(orientation);
  return { width: Math.round(width * PRINT_SCALE), height: Math.round(height * PRINT_SCALE) };
};

export const randomId = () =>
  crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

export const defaultPageTitle = () =>
  new Date().toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });

export const safeFileName = (s: string) =>
  s.replace(/[\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 80) || "page";

export const pageLabel = (meta: PageMeta) => meta.title || "Untitled";
