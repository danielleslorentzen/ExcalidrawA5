import { useEffect, useRef } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { PageMeta } from "./types";
import { BINDING_MARGIN_MM, MM, pageSize } from "./page";

/** Spacing of the on-screen ruling, in mm. */
const DOT_MM = 5;
const LINE_MM = 7;
const GRID_MM = 5;

/**
 * The page must always cross this band of the viewport (as a fraction of its
 * size), so you can pan to any edge of the page but never lose it entirely.
 */
const KEEP_IN_VIEW = { min: 0.3, max: 0.7 };

function paperBackground(paper: PageMeta["paper"], zoom: number) {
  const ink = "var(--a5-paper-ink)";
  if (paper === "dots") {
    const s = DOT_MM * MM * zoom;
    if (s < 5) return null;
    const r = Math.max(0.7, Math.min(1.6, 0.3 * MM * zoom));
    return {
      backgroundImage: `radial-gradient(circle, ${ink} ${r}px, transparent ${r + 0.6}px)`,
      backgroundSize: `${s}px ${s}px`,
      backgroundPosition: `${-s / 2}px ${-s / 2}px`,
    };
  }
  if (paper === "lines") {
    const s = LINE_MM * MM * zoom;
    if (s < 5) return null;
    return {
      backgroundImage: `linear-gradient(to bottom, transparent ${s - 1}px, ${ink} ${s - 1}px)`,
      backgroundSize: `100% ${s}px`,
      backgroundPosition: "0 0",
    };
  }
  if (paper === "grid") {
    const s = GRID_MM * MM * zoom;
    if (s < 5) return null;
    return {
      backgroundImage: `linear-gradient(to bottom, transparent ${s - 1}px, ${ink} ${s - 1}px), linear-gradient(to right, transparent ${s - 1}px, ${ink} ${s - 1}px)`,
      backgroundSize: `${s}px ${s}px`,
      backgroundPosition: "0 0",
    };
  }
  return null;
}

export function PageBackdrop({
  api,
  meta,
  theme,
}: {
  api: ExcalidrawImperativeAPI | null;
  meta: PageMeta | undefined;
  theme: "light" | "dark";
}) {
  const pageRef = useRef<HTMLDivElement>(null);
  const bindingRef = useRef<HTMLDivElement>(null);
  const clampFrame = useRef(0);

  useEffect(() => {
    if (!api || !meta) return;

    const update = (scrollX: number, scrollY: number, zoom: number) => {
      const page = pageRef.current;
      if (!page) return;
      const size = pageSize(meta.orientation);
      const left = scrollX * zoom;
      const top = scrollY * zoom;
      const width = size.width * zoom;
      const height = size.height * zoom;
      page.style.transform = `translate(${left}px, ${top}px)`;
      page.style.width = `${width}px`;
      page.style.height = `${height}px`;
      const bg = paperBackground(meta.paper, zoom);
      page.style.backgroundImage = bg?.backgroundImage ?? "none";
      page.style.backgroundSize = bg?.backgroundSize ?? "";
      page.style.backgroundPosition = bg?.backgroundPosition ?? "";

      const binding = bindingRef.current;
      if (binding) {
        binding.style.display = meta.binding === "none" ? "none" : "block";
        binding.style.width = `${BINDING_MARGIN_MM * MM * zoom}px`;
        binding.dataset.side = meta.binding;
      }

      // Keep the page from being panned out of sight.
      const { width: vw, height: vh } = api.getAppState();
      let nextLeft = left;
      let nextTop = top;
      if (left > vw * KEEP_IN_VIEW.max) nextLeft = vw * KEEP_IN_VIEW.max;
      else if (left + width < vw * KEEP_IN_VIEW.min) nextLeft = vw * KEEP_IN_VIEW.min - width;
      if (top > vh * KEEP_IN_VIEW.max) nextTop = vh * KEEP_IN_VIEW.max;
      else if (top + height < vh * KEEP_IN_VIEW.min) nextTop = vh * KEEP_IN_VIEW.min - height;
      if (nextLeft !== left || nextTop !== top) {
        cancelAnimationFrame(clampFrame.current);
        clampFrame.current = requestAnimationFrame(() =>
          api.updateScene({ appState: { scrollX: nextLeft / zoom, scrollY: nextTop / zoom } }),
        );
      }
    };

    const fromState = () => {
      const st = api.getAppState();
      update(st.scrollX, st.scrollY, st.zoom.value);
    };
    fromState();
    const unsubscribe = api.onScrollChange((x, y, zoom) => update(x, y, zoom.value));
    window.addEventListener("resize", fromState);
    return () => {
      unsubscribe();
      window.removeEventListener("resize", fromState);
      cancelAnimationFrame(clampFrame.current);
    };
  }, [api, meta]);

  return (
    <div className={`a5-desk ${theme === "dark" ? "a5-dark" : ""}`} aria-hidden>
      <div className="a5-page" ref={pageRef}>
        <div className="a5-binding" ref={bindingRef} />
      </div>
    </div>
  );
}
