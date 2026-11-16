import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDevice } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import {
  ChevronLeft,
  ChevronRight,
  EraserIcon,
  ExitFocusIcon,
  FitPageIcon,
  FitWidthIcon,
  PenIcon,
  RedoIcon,
  SelectIcon,
  UndoIcon,
} from "./icons";

// ---------- full screen ----------

/** True when the installed app was launched full screen (no toggle possible or needed). */
const launchedFullscreen = () => window.matchMedia?.("(display-mode: fullscreen)").matches ?? false;

/** Whether we can offer a Full screen toggle (not on iPhone, not when already launched full screen). */
export const canToggleFullscreen = () => !!document.fullscreenEnabled && !launchedFullscreen();

export const isTouchDevice = () => window.matchMedia?.("(pointer: coarse)").matches ?? false;

export async function setFullscreen(on: boolean) {
  try {
    if (on && !document.fullscreenElement) {
      // navigationUI: "hide" asks Android to hide the status and navigation bars too.
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    } else if (!on && document.fullscreenElement) {
      await document.exitFullscreen();
    }
  } catch {
    /* refused (e.g. not triggered by a tap) — nothing to do */
  }
}

export function useFullscreen() {
  const [on, setOn] = useState(() => !!document.fullscreenElement);
  useEffect(() => {
    const update = () => setOn(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  return on;
}

// ---------- phone bottom bar ----------

const BOTTOM_BAR = ".excalidraw .App-bottom-bar .App-toolbar-content";

/**
 * On phones, places its children inside Excalidraw's own bottom bar (between
 * the menu and undo/redo) instead of adding another row. Falls back to a
 * floating pill if that bar can't be found (e.g. after an Excalidraw upgrade).
 */
export function PhoneBottomBarSlot({ children }: { children: ReactNode }) {
  const device = useDevice();
  const mobile = device.editor.isMobile;
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!mobile) return setTarget(null);
    const root = document.querySelector(".excalidraw");
    const find = () => setTarget((prev) => {
      const el = document.querySelector<HTMLElement>(BOTTOM_BAR);
      return prev === el ? prev : el;
    });
    find();
    if (!root) return;
    // Excalidraw re-creates the bar when its menus open/close, so keep re-finding it.
    const observer = new MutationObserver(find);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [mobile]);

  if (!mobile) return null;
  return target ? (
    createPortal(<div className="a5-inbar">{children}</div>, target)
  ) : (
    <div className="a5-nav-floating">{children}</div>
  );
}

// ---------- focus mode toolbar ----------

/** Clicks Excalidraw's own (hidden) undo/redo button, so history behaves exactly as normal. */
function clickHistoryButton(label: "Undo" | "Redo") {
  const buttons = document.querySelectorAll<HTMLButtonElement>(`.excalidraw button[aria-label="${label}"]`);
  // Skip our own focus-bar buttons, which carry the same label.
  [...buttons].find((b) => !b.closest(".a5-focusbar"))?.click();
}

export type FitMode = "page" | "width";

export function FocusBar(props: {
  api: ExcalidrawImperativeAPI | null;
  activeTool: string;
  canPrev: boolean;
  canNext: boolean;
  onPrev(): void;
  onNext(): void;
  fitMode: FitMode;
  onToggleFit(): void;
  onExit(): void;
}) {
  const { api, activeTool } = props;
  const tool = (type: "selection" | "freedraw" | "eraser", icon: ReactNode, label: string) => (
    <button
      className={activeTool === type ? "is-active" : ""}
      title={label}
      aria-label={label}
      aria-pressed={activeTool === type}
      onClick={() => api?.setActiveTool({ type })}
    >
      {icon}
    </button>
  );
  return (
    <div className="a5-focusbar" role="toolbar" aria-label="Focus mode tools">
      {tool("selection", SelectIcon, "Select")}
      {tool("freedraw", PenIcon, "Pen")}
      {tool("eraser", EraserIcon, "Eraser")}
      <span className="a5-focusbar-sep" />
      <button title="Undo" aria-label="Undo" onClick={() => clickHistoryButton("Undo")}>
        {UndoIcon}
      </button>
      <button title="Redo" aria-label="Redo" onClick={() => clickHistoryButton("Redo")}>
        {RedoIcon}
      </button>
      <span className="a5-focusbar-sep" />
      <button title="Previous page" aria-label="Previous page" disabled={!props.canPrev} onClick={props.onPrev}>
        {ChevronLeft}
      </button>
      <button title="Next page" aria-label="Next page" disabled={!props.canNext} onClick={props.onNext}>
        {ChevronRight}
      </button>
      <button
        title={props.fitMode === "page" ? "Fit page width" : "Fit whole page"}
        aria-label={props.fitMode === "page" ? "Fit page width" : "Fit whole page"}
        onClick={props.onToggleFit}
      >
        {props.fitMode === "page" ? FitWidthIcon : FitPageIcon}
      </button>
      <button title="Exit focus mode (Alt+F)" aria-label="Exit focus mode" onClick={props.onExit}>
        {ExitFocusIcon}
      </button>
    </div>
  );
}
