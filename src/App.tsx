import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CaptureUpdateAction,
  Excalidraw,
  Footer,
  MainMenu,
  Sidebar,
  getCommonBounds,
  getSceneVersion,
  loadFromBlob,
  restoreElements,
  serializeAsJSON,
  useDevice,
} from "@excalidraw/excalidraw";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { NotebookBackup, NotebookIndex, PageContent, PageMeta, Section } from "./types";
import {
  SECTION_COLORS,
  deletePage as deletePageData,
  emptyContent,
  loadIndex,
  loadPage,
  loadThumbs,
  newPageMeta,
  newSection,
  requestPersistentStorage,
  saveIndex,
  savePage,
  saveThumb,
} from "./storage";
import { buildPdf, buildPng, deliverFile, renderThumbnail } from "./exporting";
import { contentFromScan, filesToScans, orientationFor, scanToElement } from "./scans";
import { pageLabel, pageSize } from "./page";
import { PageBackdrop } from "./PageBackdrop";
import { PagesPanel, type Layout, type PanelActions } from "./PagesPanel";
import {
  CheckboxOffIcon,
  CheckboxOnIcon,
  ChevronLeft,
  ChevronRight,
  DownloadIcon,
  FileIcon,
  ImageIcon,
  PagesIcon,
  PdfIcon,
  PlusIcon,
  ScanIcon,
  SectionIcon,
  UploadIcon,
} from "./icons";

const SIDEBAR = "pages";
const PREFS_KEY = "a5x-prefs";
const DOCKED_KEY = "a5x-sidebar-docked";
const PRINT_RULING_KEY = "a5x-print-ruling";
const SAVE_DELAY = 400;
const THUMB_DELAY = 1500;

/** Tool settings remembered between sessions. */
const PREF_KEYS = [
  "theme",
  "penMode",
  "currentItemStrokeColor",
  "currentItemBackgroundColor",
  "currentItemFillStyle",
  "currentItemStrokeWidth",
  "currentItemStrokeStyle",
  "currentItemRoughness",
  "currentItemOpacity",
  "currentItemFontFamily",
  "currentItemFontSize",
  "currentItemTextAlign",
  "currentItemRoundness",
  "currentItemArrowType",
] as const satisfies readonly (keyof AppState)[];

const readJSON = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const writeJSON = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
};

/** Only keep live elements and the image files they actually reference. */
function toContent(elements: readonly ExcalidrawElement[], files: BinaryFiles): PageContent {
  const live = elements.filter((el) => !el.isDeleted);
  const used: BinaryFiles = {};
  for (const el of live) {
    if (el.type === "image" && el.fileId && files[el.fileId]) used[el.fileId] = files[el.fileId];
  }
  return { elements: live, files: used };
}

function saveKey(elements: readonly ExcalidrawElement[], files: BinaryFiles) {
  let present = 0;
  for (const el of elements) if (el.type === "image" && !el.isDeleted && el.fileId && files[el.fileId]) present++;
  return `${getSceneVersion(elements)}:${present}`;
}

/** Notebook reading order: sections in order, pages in order within each. */
const orderedPages = (index: NotebookIndex) =>
  index.sections.flatMap((s) => index.pages.filter((p) => p.sectionId === s.id));

const isMobileWidth = () => window.innerWidth < 730;

/** Renders its children (floating above the bottom bar) only in Excalidraw's phone layout. */
function MobileOnly({ children }: { children: ReactNode }) {
  const device = useDevice();
  return device.editor.isMobile ? <div className="a5-nav-floating">{children}</div> : null;
}

export default function App() {
  const [index, setIndex] = useState<NotebookIndex | null>(null);
  const [currentPageId, setCurrentPageId] = useState<string>("");
  const [initialData, setInitialData] = useState<ExcalidrawInitialDataState | null>(null);
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [theme, setTheme] = useState<"light" | "dark">(() => readJSON(PREFS_KEY, {} as { theme?: "light" | "dark" }).theme ?? "light");
  const [docked, setDocked] = useState<boolean>(() => readJSON(DOCKED_KEY, false));
  const [printRuling, setPrintRuling] = useState<boolean>(() => readJSON(PRINT_RULING_KEY, false));

  const indexRef = useRef<NotebookIndex | null>(null);
  const currentRef = useRef("");
  const pending = useRef<{ pageId: string; elements: readonly ExcalidrawElement[]; files: BinaryFiles; key: string } | null>(null);
  const saveTimer = useRef(0);
  const lastSavedKey = useRef("");
  const thumbTimers = useRef<Record<string, number>>({});
  const prefsJson = useRef("");
  const switching = useRef(false);
  const scanInput = useRef<HTMLInputElement>(null);
  const sceneInput = useRef<HTMLInputElement>(null);
  const backupInput = useRef<HTMLInputElement>(null);

  // ---------- notebook index ----------

  const mutateIndex = useCallback((fn: (idx: NotebookIndex) => NotebookIndex) => {
    const prev = indexRef.current;
    if (!prev) return prev;
    const next = fn(prev);
    indexRef.current = next;
    setIndex(next);
    void saveIndex(next);
    return next;
  }, []);

  const metaOf = (id: string) => indexRef.current?.pages.find((p) => p.id === id);

  // ---------- startup ----------

  useEffect(() => {
    void requestPersistentStorage();
    (async () => {
      const idx = await loadIndex();
      const id = idx.pages.some((p) => p.id === idx.lastPageId) ? idx.lastPageId! : orderedPages(idx)[0].id;
      const content = await loadPage(id);
      const prefs = readJSON<Partial<AppState>>(PREFS_KEY, {});
      indexRef.current = idx;
      currentRef.current = id;
      setIndex(idx);
      setCurrentPageId(id);
      setInitialData({
        elements: restoreElements(content.elements, null),
        files: content.files,
        appState: { ...prefs, viewBackgroundColor: "transparent" },
        scrollToContent: false,
      });
      lastSavedKey.current = saveKey(content.elements, content.files);
      setThumbs(await loadThumbs(idx.pages.map((p) => p.id)));
    })();
  }, []);

  // ---------- viewport ----------

  const fitPage = useCallback(
    (meta: PageMeta | undefined) => {
      if (!api || !meta) return;
      const { width: w, height: h } = api.getAppState();
      const page = pageSize(meta.orientation);
      const mobile = isMobileWidth();
      const top = mobile ? 72 : 76;
      const bottom = mobile ? 136 : 64;
      const side = mobile ? 12 : 32;
      const zoom = Math.max(0.1, Math.min(4, (w - side * 2) / page.width, (h - top - bottom) / page.height));
      const scrollX = (w / zoom - page.width) / 2;
      const scrollY = (top + (h - top - bottom - page.height * zoom) / 2) / zoom;
      api.updateScene({
        appState: { zoom: { value: zoom as AppState["zoom"]["value"] }, scrollX, scrollY },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    },
    [api],
  );

  useEffect(() => {
    if (api) requestAnimationFrame(() => fitPage(metaOf(currentRef.current)));
  }, [api, fitPage]);

  // ---------- saving ----------

  const scheduleThumb = useCallback((pageId: string, content?: PageContent) => {
    clearTimeout(thumbTimers.current[pageId]);
    thumbTimers.current[pageId] = window.setTimeout(async () => {
      const meta = metaOf(pageId);
      if (!meta) return;
      try {
        const url = await renderThumbnail(content ?? (await loadPage(pageId)), meta);
        await saveThumb(pageId, url);
        setThumbs((t) => ({ ...t, [pageId]: url }));
      } catch (err) {
        console.warn("Thumbnail failed", err);
      }
    }, THUMB_DELAY);
  }, []);

  const flushSave = useCallback(async () => {
    clearTimeout(saveTimer.current);
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    const content = toContent(p.elements, p.files);
    await savePage(p.pageId, content);
    if (p.pageId === currentRef.current) lastSavedKey.current = p.key;
    mutateIndex((idx) => ({
      ...idx,
      pages: idx.pages.map((m) => (m.id === p.pageId ? { ...m, updatedAt: Date.now() } : m)),
    }));
    scheduleThumb(p.pageId, content);
  }, [mutateIndex, scheduleThumb]);

  // Save before the tab is hidden or closed (important on mobile).
  useEffect(() => {
    const onHide = () => void flushSave();
    const onVisibility = () => document.visibilityState === "hidden" && onHide();
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [flushSave]);

  const onChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
      // The paper is drawn behind the canvas, so the canvas must stay transparent.
      if (appState.viewBackgroundColor !== "transparent") {
        queueMicrotask(() => api?.updateScene({ appState: { viewBackgroundColor: "transparent" } }));
      }
      if (appState.theme !== theme) setTheme(appState.theme);
      const prefs = Object.fromEntries(PREF_KEYS.map((k) => [k, appState[k]]));
      const json = JSON.stringify(prefs);
      if (json !== prefsJson.current) {
        prefsJson.current = json;
        writeJSON(PREFS_KEY, prefs);
      }

      if (switching.current || !currentRef.current) return;
      const key = saveKey(elements, files);
      if (key === lastSavedKey.current) return;
      pending.current = { pageId: currentRef.current, elements, files, key };
      clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => void flushSave(), SAVE_DELAY);
    },
    [api, theme, flushSave],
  );

  // ---------- navigation ----------

  const showPage = useCallback(
    async (id: string, opts: { force?: boolean } = {}) => {
      if (!api || (!opts.force && id === currentRef.current)) return;
      switching.current = true;
      try {
        await flushSave();
        const content = await loadPage(id);
        const elements = restoreElements(content.elements, null);
        currentRef.current = id;
        setCurrentPageId(id);
        api.addFiles(Object.values(content.files));
        api.updateScene({
          elements,
          appState: { selectedElementIds: {}, selectedGroupIds: {} },
          captureUpdate: CaptureUpdateAction.NEVER,
        });
        api.history.clear();
        lastSavedKey.current = saveKey(elements, api.getFiles());
        fitPage(metaOf(id));
        mutateIndex((idx) => ({ ...idx, lastPageId: id }));
      } finally {
        switching.current = false;
      }
    },
    [api, flushSave, fitPage, mutateIndex],
  );

  const closeSidebarIfFloating = useCallback(() => {
    if (api && (!docked || isMobileWidth())) api.toggleSidebar({ name: SIDEBAR, force: false });
  }, [api, docked]);

  const step = useCallback(
    (dir: -1 | 1) => {
      const idx = indexRef.current;
      if (!idx) return;
      const order = orderedPages(idx);
      const i = order.findIndex((p) => p.id === currentRef.current);
      const target = order[i + dir];
      if (target) void showPage(target.id);
    },
    [showPage],
  );

  // Alt+PageUp / Alt+PageDown flip pages.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || (e.key !== "PageUp" && e.key !== "PageDown")) return;
      e.preventDefault();
      e.stopPropagation();
      step(e.key === "PageUp" ? -1 : 1);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [step]);

  // ---------- toasts ----------

  const toast = useCallback(
    (message: string, duration = 3000) => api?.setToast({ message, closable: true, duration }),
    [api],
  );

  const run = useCallback(
    async (busy: string, task: () => Promise<string | void>) => {
      toast(busy, Infinity);
      try {
        const done = await task();
        if (done) toast(done);
        else api?.setToast(null);
      } catch (err) {
        console.error(err);
        toast(`Something went wrong: ${(err as Error).message}`, 6000);
      }
    },
    [api, toast],
  );

  // ---------- page operations ----------

  /** Inserts new pages right after `afterId` (or at the end of the section). */
  const insertPages = (idx: NotebookIndex, metas: PageMeta[], afterId?: string): NotebookIndex => {
    const pages = [...idx.pages];
    let at = afterId ? pages.findIndex((p) => p.id === afterId) + 1 : 0;
    if (!afterId || at === 0) {
      const sectionId = metas[0].sectionId;
      const last = pages.map((p) => p.sectionId).lastIndexOf(sectionId);
      at = last === -1 ? pages.length : last + 1;
    }
    pages.splice(at, 0, ...metas);
    return { ...idx, pages };
  };

  const addPage = useCallback(
    async (sectionId?: string) => {
      const current = metaOf(currentRef.current);
      const section = sectionId ?? current?.sectionId ?? indexRef.current!.sections[0].id;
      const meta = newPageMeta(section, current ? { orientation: current.orientation, binding: current.binding, paper: current.paper } : {});
      await savePage(meta.id, emptyContent());
      const afterId = current && current.sectionId === section ? current.id : undefined;
      mutateIndex((idx) => insertPages(idx, [meta], afterId));
      await showPage(meta.id);
      return meta;
    },
    [mutateIndex, showPage],
  );

  const deletePage = useCallback(
    async (id: string) => {
      const meta = metaOf(id);
      if (!meta || !confirm(`Delete “${pageLabel(meta)}”? This can't be undone.`)) return;
      const idx = indexRef.current!;
      const order = orderedPages(idx);
      if (id === currentRef.current) {
        pending.current = null;
        const i = order.findIndex((p) => p.id === id);
        const neighbour = order[i + 1] ?? order[i - 1];
        if (neighbour) await showPage(neighbour.id);
        else await addPage(meta.sectionId);
      }
      mutateIndex((x) => ({ ...x, pages: x.pages.filter((p) => p.id !== id) }));
      await deletePageData(id);
    },
    [addPage, mutateIndex, showPage],
  );

  const duplicatePage = useCallback(
    async (id: string) => {
      await flushSave();
      const meta = metaOf(id);
      if (!meta) return;
      const copy = newPageMeta(meta.sectionId, { ...meta, title: `${meta.title} (copy)` });
      await savePage(copy.id, await loadPage(id));
      mutateIndex((idx) => insertPages(idx, [copy], id));
      scheduleThumb(copy.id);
      await showPage(copy.id);
    },
    [flushSave, mutateIndex, scheduleThumb, showPage],
  );

  const updatePage = useCallback(
    (id: string, patch: Partial<PageMeta>) => {
      const before = metaOf(id);
      mutateIndex((idx) => ({ ...idx, pages: idx.pages.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)) }));
      if (patch.orientation && before && patch.orientation !== before.orientation) {
        scheduleThumb(id);
        if (id === currentRef.current) fitPage(metaOf(id));
      }
    },
    [fitPage, mutateIndex, scheduleThumb],
  );

  const movePage = useCallback(
    (id: string, dir: -1 | 1) =>
      mutateIndex((idx) => {
        const pages = [...idx.pages];
        const i = pages.findIndex((p) => p.id === id);
        let j = i + dir;
        while (j >= 0 && j < pages.length && pages[j].sectionId !== pages[i].sectionId) j += dir;
        if (j < 0 || j >= pages.length) return idx;
        [pages[i], pages[j]] = [pages[j], pages[i]];
        return { ...idx, pages };
      }),
    [mutateIndex],
  );

  const movePageToSection = useCallback(
    (id: string, sectionId: string) =>
      mutateIndex((idx) => {
        const page = idx.pages.find((p) => p.id === id);
        if (!page) return idx;
        const rest = idx.pages.filter((p) => p.id !== id);
        return insertPages({ ...idx, pages: rest }, [{ ...page, sectionId }]);
      }),
    [mutateIndex],
  );

  const reorderPages = useCallback(
    (layout: Layout) =>
      mutateIndex((idx) => {
        const byId = new Map(idx.pages.map((p) => [p.id, p]));
        const placed = new Set<string>();
        const pages: PageMeta[] = [];
        for (const s of idx.sections) {
          for (const id of layout[s.id] ?? []) {
            const p = byId.get(id);
            if (p && !placed.has(id)) {
              placed.add(id);
              pages.push(p.sectionId === s.id ? p : { ...p, sectionId: s.id });
            }
          }
        }
        // Never drop a page that the layout somehow missed.
        for (const p of idx.pages) if (!placed.has(p.id)) pages.push(p);
        return { ...idx, pages };
      }),
    [mutateIndex],
  );

  const reorderSections = useCallback(
    (ids: string[]) =>
      mutateIndex((idx) => {
        const rank = new Map(ids.map((id, i) => [id, i]));
        const sections = [...idx.sections].sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9));
        return { ...idx, sections };
      }),
    [mutateIndex],
  );

  const addSection = useCallback(async () => {
    const name = prompt("Name for the new section (like a tab divider):", "New section")?.trim();
    if (!name) return;
    const idx = indexRef.current!;
    const section = newSection(name, SECTION_COLORS[idx.sections.length % SECTION_COLORS.length]);
    mutateIndex((x) => ({ ...x, sections: [...x.sections, section] }));
    await addPage(section.id);
  }, [addPage, mutateIndex]);

  const updateSection = useCallback(
    (id: string, patch: Partial<Section>) =>
      mutateIndex((idx) => ({ ...idx, sections: idx.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) })),
    [mutateIndex],
  );

  const moveSection = useCallback(
    (id: string, dir: -1 | 1) =>
      mutateIndex((idx) => {
        const sections = [...idx.sections];
        const i = sections.findIndex((s) => s.id === id);
        const j = i + dir;
        if (j < 0 || j >= sections.length) return idx;
        [sections[i], sections[j]] = [sections[j], sections[i]];
        return { ...idx, sections };
      }),
    [mutateIndex],
  );

  const deleteSection = useCallback(
    async (id: string) => {
      const idx = indexRef.current!;
      const section = idx.sections.find((s) => s.id === id);
      const pages = idx.pages.filter((p) => p.sectionId === id);
      if (!section || idx.sections.length < 2) return;
      if (!confirm(`Delete section “${section.name}” and its ${pages.length} page(s)? This can't be undone.`)) return;
      if (pages.some((p) => p.id === currentRef.current)) {
        pending.current = null;
        const other = orderedPages(idx).find((p) => p.sectionId !== id);
        if (other) await showPage(other.id);
        else {
          const fallback = idx.sections.find((s) => s.id !== id)!;
          await addPage(fallback.id);
        }
      }
      mutateIndex((x) => ({
        ...x,
        sections: x.sections.filter((s) => s.id !== id),
        pages: x.pages.filter((p) => p.sectionId !== id),
      }));
      await Promise.all(pages.map((p) => deletePageData(p.id)));
    },
    [addPage, mutateIndex, showPage],
  );

  // ---------- export ----------

  const exportPagesPdf = useCallback(
    (ids: string[], name: string) =>
      run(ids.length > 1 ? `Rendering ${ids.length} pages…` : "Rendering PDF…", async () => {
        await flushSave();
        const pages = [];
        for (const id of ids) {
          const meta = metaOf(id);
          if (meta) pages.push({ meta, content: await loadPage(id) });
        }
        await deliverFile(await buildPdf(pages, { ruling: printRuling }), name, "pdf");
        return "PDF ready. When printing, choose “Actual size” (100%).";
      }),
    [flushSave, run, printRuling],
  );

  const exportCurrentPng = useCallback(
    () =>
      run("Rendering PNG…", async () => {
        await flushSave();
        const meta = metaOf(currentRef.current)!;
        await deliverFile(await buildPng(meta, await loadPage(meta.id), { ruling: printRuling }), meta.title, "png");
      }),
    [flushSave, run, printRuling],
  );

  const saveCurrentAsExcalidraw = useCallback(async () => {
    if (!api) return;
    const meta = metaOf(currentRef.current)!;
    const json = serializeAsJSON(api.getSceneElements(), { viewBackgroundColor: "#ffffff" }, api.getFiles(), "local");
    await deliverFile(new Blob([json], { type: "application/json" }), meta.title, "excalidraw");
  }, [api]);

  // ---------- import ----------

  const importScans = useCallback(
    (files: File[]) =>
      run("Importing scan…", async () => {
        if (!api) return;
        const scans = await filesToScans(files);
        if (!scans.length) return "No images or PDFs found in that selection.";
        await flushSave();
        const current = metaOf(currentRef.current)!;
        const currentEmpty = api.getSceneElements().length === 0;
        let rest = scans;
        if (currentEmpty) {
          const orientation = orientationFor(scans[0]);
          if (orientation !== current.orientation) updatePage(current.id, { orientation });
          const { element, file } = scanToElement(scans[0], orientation);
          api.addFiles([file]);
          api.updateScene({ elements: [element], captureUpdate: CaptureUpdateAction.IMMEDIATELY });
          rest = scans.slice(1);
        }
        const metas: PageMeta[] = [];
        for (const [i, scan] of rest.entries()) {
          const orientation = orientationFor(scan);
          const meta = newPageMeta(current.sectionId, {
            orientation,
            binding: current.binding,
            paper: "blank",
            title: rest.length > 1 || currentEmpty ? `Scan ${i + (currentEmpty ? 2 : 1)}` : "Scan",
          });
          const content = contentFromScan(scan, orientation);
          await savePage(meta.id, content);
          metas.push(meta);
        }
        if (metas.length) {
          mutateIndex((idx) => insertPages(idx, metas, current.id));
          metas.forEach((m) => scheduleThumb(m.id));
          if (!currentEmpty) await showPage(metas[0].id);
        }
        return scans.length === 1 ? "Scan added." : `Imported ${scans.length} pages.`;
      }),
    [api, flushSave, mutateIndex, run, scheduleThumb, showPage, updatePage],
  );

  const openExcalidrawAsPage = useCallback(
    (file: File) =>
      run("Opening drawing…", async () => {
        const scene = await loadFromBlob(file, null, null);
        const meta = await addPage();
        if (!api || !meta) return;
        const elements = scene.elements.filter((el) => !el.isDeleted);
        const page = pageSize(meta.orientation);
        let moved: ExcalidrawElement[] = [...elements];
        if (elements.length) {
          const [minX, minY, maxX, maxY] = getCommonBounds(elements);
          const dx = (page.width - (maxX - minX)) / 2 - minX;
          const dy = (page.height - (maxY - minY)) / 2 - minY;
          moved = elements.map((el) => ({ ...el, x: el.x + dx, y: el.y + dy }));
        }
        api.addFiles(Object.values(scene.files));
        api.updateScene({ elements: moved, captureUpdate: CaptureUpdateAction.IMMEDIATELY });
        updatePage(meta.id, { title: file.name.replace(/\.excalidraw(\.json)?$/i, "") });
        return "Drawing opened as a new page.";
      }),
    [addPage, api, run, updatePage],
  );

  // ---------- backup ----------

  const backupNotebook = useCallback(
    () =>
      run("Packing notebook…", async () => {
        await flushSave();
        const idx = indexRef.current!;
        const pages: Record<string, PageContent> = {};
        for (const p of idx.pages) pages[p.id] = await loadPage(p.id);
        const backup: NotebookBackup = { format: "a5excalidraw-notebook", version: 1, exportedAt: Date.now(), index: idx, pages };
        const date = new Date().toISOString().slice(0, 10);
        await deliverFile(new Blob([JSON.stringify(backup)], { type: "application/json" }), `a5-notebook-${date}`, "json");
        return `Backed up ${idx.pages.length} pages.`;
      }),
    [flushSave, run],
  );

  const restoreBackup = useCallback(
    async (file: File) => {
      let backup: NotebookBackup;
      try {
        backup = JSON.parse(await file.text());
        if (backup.format !== "a5excalidraw-notebook") throw new Error();
      } catch {
        toast("That file isn't an A5 Excalidraw notebook backup.", 5000);
        return;
      }
      const n = backup.index.pages.length;
      if (!confirm(`Restore ${n} page(s) from this backup?\n\nPages are added to your notebook; any page that's already here is replaced by the backup copy.`)) return;
      await run("Restoring…", async () => {
        await flushSave();
        for (const p of backup.index.pages) await savePage(p.id, backup.pages[p.id] ?? emptyContent());
        mutateIndex((idx) => {
          const sections = [...idx.sections];
          for (const s of backup.index.sections) {
            const i = sections.findIndex((x) => x.id === s.id);
            if (i >= 0) sections[i] = s;
            else sections.push(s);
          }
          const incoming = new Map(backup.index.pages.map((p) => [p.id, p]));
          const pages = idx.pages.map((p) => incoming.get(p.id) ?? p);
          for (const p of backup.index.pages) if (!idx.pages.some((x) => x.id === p.id)) pages.push(p);
          return { ...idx, sections, pages };
        });
        backup.index.pages.forEach((p) => scheduleThumb(p.id));
        if (backup.index.pages.some((p) => p.id === currentRef.current)) await showPage(currentRef.current, { force: true });
        return `Restored ${n} page(s).`;
      });
    },
    [flushSave, mutateIndex, run, scheduleThumb, showPage, toast],
  );

  // ---------- UI ----------

  const panelActions: PanelActions = useMemo(
    () => ({
      openPage: (id) => {
        void showPage(id);
        closeSidebarIfFloating();
      },
      addPage: (sectionId) => void addPage(sectionId),
      renamePage: (id, title) => updatePage(id, { title }),
      duplicatePage: (id) => void duplicatePage(id),
      deletePage: (id) => void deletePage(id),
      movePage,
      movePageToSection,
      reorderPages,
      reorderSections,
      updatePage,
      exportPagesPdf: (ids, name) => void exportPagesPdf(ids, name),
      addSection: () => void addSection(),
      updateSection,
      moveSection,
      deleteSection: (id) => void deleteSection(id),
    }),
    [showPage, closeSidebarIfFloating, addPage, updatePage, duplicatePage, deletePage, movePage, movePageToSection, reorderPages, reorderSections, exportPagesPdf, addSection, updateSection, moveSection, deleteSection],
  );

  const currentMeta = index?.pages.find((p) => p.id === currentPageId);
  const order = index ? orderedPages(index) : [];
  const position = order.findIndex((p) => p.id === currentPageId);
  const currentSection = index?.sections.find((s) => s.id === currentMeta?.sectionId);

  const pageNav = (isMobile: boolean, placement = "") => (
    <div className={`a5-nav ${placement}`}>
      <button className="a5-nav-btn" title="Previous page (Alt+PageUp)" disabled={position <= 0} onClick={() => step(-1)}>
        {ChevronLeft}
      </button>
      <button
        className="a5-nav-title"
        title="Show pages"
        onClick={() => api?.toggleSidebar({ name: SIDEBAR })}
        style={{ ["--tab" as string]: currentSection?.color }}
      >
        <span className="a5-nav-tab" />
        {!isMobile && <span className="a5-nav-label">{currentMeta ? pageLabel(currentMeta) : ""}</span>}
        <span className="a5-nav-count">
          {position + 1}/{order.length}
        </span>
      </button>
      <button className="a5-nav-btn" title="Next page (Alt+PageDown)" disabled={position >= order.length - 1} onClick={() => step(1)}>
        {ChevronRight}
      </button>
      <button className="a5-nav-btn" title="New page" onClick={() => void addPage()}>
        {PlusIcon}
      </button>
    </div>
  );

  if (!index || !initialData) return <div className="a5-loading">Opening notebook…</div>;

  return (
    <div className="a5-app">
      <PageBackdrop api={api} meta={currentMeta} theme={theme} />
      <div className="a5-canvas">
        <Excalidraw
          excalidrawAPI={setApi}
          initialData={initialData}
          onChange={onChange}
          handleKeyboardGlobally
          // On phones the top row is full of tools, so the navigator floats above the bottom bar instead.
          // On narrower desktop windows it moves to the (otherwise empty) centre of the footer.
          renderTopRightUI={(isMobile) => (isMobile ? null : pageNav(false, "a5-nav-top"))}
          UIOptions={{
            canvasActions: {
              changeViewBackgroundColor: false,
              loadScene: false,
              saveToActiveFile: false,
              saveAsImage: false,
              export: false,
            },
          }}
        >
          <MobileOnly>{pageNav(true)}</MobileOnly>
          <Footer>{pageNav(true, "a5-nav-footer")}</Footer>

          <MainMenu>
            <MainMenu.Item icon={PagesIcon} onSelect={() => api?.toggleSidebar({ name: SIDEBAR, force: true })}>
              Pages
            </MainMenu.Item>
            <MainMenu.Item icon={PlusIcon} onSelect={() => void addPage()}>
              New page
            </MainMenu.Item>
            <MainMenu.Item icon={ScanIcon} onSelect={() => scanInput.current?.click()}>
              Import scan / photo / PDF…
            </MainMenu.Item>
            <MainMenu.Separator />
            <MainMenu.Item icon={PdfIcon} onSelect={() => void exportPagesPdf([currentPageId], currentMeta?.title ?? "page")}>
              Export page as A5 PDF
            </MainMenu.Item>
            <MainMenu.Item
              icon={SectionIcon}
              onSelect={() =>
                currentSection &&
                void exportPagesPdf(
                  order.filter((p) => p.sectionId === currentSection.id).map((p) => p.id),
                  currentSection.name,
                )
              }
            >
              Export section as PDF
            </MainMenu.Item>
            <MainMenu.Item icon={ImageIcon} onSelect={() => void exportCurrentPng()}>
              Export page as PNG (300 DPI)
            </MainMenu.Item>
            <MainMenu.Item
              icon={printRuling ? CheckboxOnIcon : CheckboxOffIcon}
              selected={printRuling}
              aria-checked={printRuling}
              role="menuitemcheckbox"
              onSelect={(event) => {
                event.preventDefault(); // keep the menu open so the toggle is visible
                setPrintRuling(!printRuling);
                writeJSON(PRINT_RULING_KEY, !printRuling);
              }}
            >
              Print paper ruling (dots / lines / grid)
            </MainMenu.Item>
            <MainMenu.Separator />
            <MainMenu.Item icon={FileIcon} onSelect={() => sceneInput.current?.click()}>
              Open .excalidraw as page…
            </MainMenu.Item>
            <MainMenu.Item icon={FileIcon} onSelect={() => void saveCurrentAsExcalidraw()}>
              Save page as .excalidraw
            </MainMenu.Item>
            <MainMenu.Item icon={DownloadIcon} onSelect={() => void backupNotebook()}>
              Back up notebook
            </MainMenu.Item>
            <MainMenu.Item icon={UploadIcon} onSelect={() => backupInput.current?.click()}>
              Restore from backup…
            </MainMenu.Item>
            <MainMenu.Separator />
            <MainMenu.DefaultItems.ClearCanvas />
            <MainMenu.DefaultItems.ToggleTheme />
            <MainMenu.DefaultItems.Help />
          </MainMenu>

          <Sidebar
            name={SIDEBAR}
            docked={docked}
            onDock={(d) => {
              setDocked(d);
              writeJSON(DOCKED_KEY, d);
            }}
            className="a5-sidebar"
          >
            <Sidebar.Header>
              <div className="a5-sidebar-title">Notebook</div>
            </Sidebar.Header>
            <PagesPanel index={index} currentPageId={currentPageId} thumbs={thumbs} actions={panelActions} />
          </Sidebar>
        </Excalidraw>
      </div>

      <input
        ref={scanInput}
        type="file"
        accept="image/*,application/pdf,.pdf"
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length) void importScans(files);
        }}
      />
      <input
        ref={sceneInput}
        type="file"
        accept=".excalidraw,.json,application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void openExcalidrawAsPage(file);
        }}
      />
      <input
        ref={backupInput}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void restoreBackup(file);
        }}
      />
    </div>
  );
}
