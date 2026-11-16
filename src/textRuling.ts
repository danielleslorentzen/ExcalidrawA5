import { newElementWith } from "@excalidraw/excalidraw";
import type { ExcalidrawElement, ExcalidrawTextElement } from "@excalidraw/excalidraw/element/types";

/**
 * Font metrics copied from Excalidraw's FONT_METADATA (0.18), keyed by
 * fontFamily id. Used to place text baselines exactly on the ruling.
 */
const METRICS: Record<number, { upm: number; ascender: number; descender: number; lineHeight: number }> = {
  1: { upm: 1000, ascender: 886, descender: -374, lineHeight: 1.25 }, // Virgil
  2: { upm: 2048, ascender: 1577, descender: -471, lineHeight: 1.15 }, // Helvetica
  3: { upm: 2048, ascender: 1900, descender: -480, lineHeight: 1.2 }, // Cascadia
  5: { upm: 1000, ascender: 886, descender: -374, lineHeight: 1.25 }, // Excalifont
  6: { upm: 1000, ascender: 1011, descender: -353, lineHeight: 1.35 }, // Nunito
  7: { upm: 1000, ascender: 923, descender: -220, lineHeight: 1.15 }, // Lilita One
  8: { upm: 1000, ascender: 750, descender: -250, lineHeight: 1.25 }, // Comic Shanns
  9: { upm: 2048, ascender: 1854, descender: -434, lineHeight: 1.15 }, // Liberation Sans
};
const metricsFor = (fontFamily: number) => METRICS[fontFamily] ?? METRICS[5];

/**
 * Line pitch for a font size: a whole number of ruling steps. Text whose
 * natural line height is more than ~25% taller than one step gets two (or more),
 * so ascenders and descenders never collide.
 */
export function linePitch(fontSize: number, fontFamily: number, spacing: number) {
  const natural = fontSize * metricsFor(fontFamily).lineHeight;
  return Math.max(1, Math.ceil(natural / spacing - 0.25)) * spacing;
}

const close = (a: number, b: number) => Math.abs(a - b) < 0.01;

/**
 * Returns the text element with its line spacing set to the ruling and its
 * first baseline moved onto the nearest ruled line / dot row, or null if it
 * already fits. Rotated text and text inside shapes are left alone.
 */
export function alignTextToRuling(el: ExcalidrawTextElement, spacing: number): ExcalidrawTextElement | null {
  if (el.containerId || el.angle !== 0) return null;
  const m = metricsFor(el.fontFamily);
  const pitch = linePitch(el.fontSize, el.fontFamily, spacing);
  const lineHeight = pitch / el.fontSize;
  const height = el.text.split("\n").length * pitch;
  // Excalidraw centres each glyph line vertically within its line box, so the
  // baseline sits at (pitch + fontSize·(ascender+descender)/unitsPerEm) / 2 below the top.
  const baselineOffset = (pitch + (el.fontSize * (m.ascender + m.descender)) / m.upm) / 2;
  const y = Math.round((el.y + baselineOffset) / spacing) * spacing - baselineOffset;
  if (close(lineHeight, el.lineHeight) && close(height, el.height) && close(y, el.y)) return null;
  return newElementWith(el, {
    lineHeight: lineHeight as ExcalidrawTextElement["lineHeight"],
    height,
    y,
  });
}

/**
 * Tracks which text elements we've already handled, so only text you create,
 * edit, move or resize gets snapped. Text already on a page is left as it was.
 */
export class TextRulingTracker {
  private seen = new Map<string, number>();

  /** Mark everything currently on the page as already handled. */
  baseline(elements: readonly ExcalidrawElement[]) {
    this.seen.clear();
    for (const el of elements) if (el.type === "text") this.seen.set(el.id, el.version);
  }

  /** Returns a new element list with changed text aligned, or null if nothing needed changing. */
  align(elements: readonly ExcalidrawElement[], spacing: number): ExcalidrawElement[] | null {
    let changed = false;
    const next = elements.map((el) => {
      if (el.type !== "text" || el.isDeleted || this.seen.get(el.id) === el.version) return el;
      const fixed = alignTextToRuling(el, spacing);
      this.seen.set(el.id, (fixed ?? el).version);
      if (!fixed) return el;
      changed = true;
      return fixed;
    });
    return changed ? next : null;
  }
}
