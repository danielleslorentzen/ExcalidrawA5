import { createStore, get, set, del, getMany, setMany } from "idb-keyval";
import type { NotebookIndex, PageContent, PageMeta, Section } from "./types";
import { defaultPageTitle, randomId } from "./page";

const store = createStore("a5excalidraw", "notebook");

const INDEX_KEY = "index";
const pageKey = (id: string) => `page:${id}`;
const thumbKey = (id: string) => `thumb:${id}`;

export const SECTION_COLORS = ["#e03131", "#f08c00", "#2f9e44", "#1971c2", "#6741d9", "#c2255c", "#868e96"];

export const newSection = (name: string, color: string): Section => ({ id: randomId(), name, color });

export const newPageMeta = (sectionId: string, base?: Partial<PageMeta>): PageMeta => {
  const now = Date.now();
  return {
    orientation: "portrait",
    binding: "left",
    paper: "dots",
    ...base,
    id: randomId(),
    title: base?.title ?? defaultPageTitle(),
    sectionId,
    createdAt: now,
    updatedAt: now,
  };
};

export const emptyContent = (): PageContent => ({ elements: [], files: {} });

export async function loadIndex(): Promise<NotebookIndex> {
  const existing = await get<NotebookIndex>(INDEX_KEY, store);
  if (existing && existing.sections.length && existing.pages.length) return existing;
  const section = newSection("Notes", SECTION_COLORS[3]);
  const page = newPageMeta(section.id);
  const index: NotebookIndex = { version: 1, sections: [section], pages: [page], lastPageId: page.id };
  await setMany([[INDEX_KEY, index], [pageKey(page.id), emptyContent()]], store);
  return index;
}

export const saveIndex = (index: NotebookIndex) => set(INDEX_KEY, index, store);

export async function loadPage(id: string): Promise<PageContent> {
  return (await get<PageContent>(pageKey(id), store)) ?? emptyContent();
}

export const savePage = (id: string, content: PageContent) => set(pageKey(id), content, store);

export async function deletePage(id: string) {
  await Promise.all([del(pageKey(id), store), del(thumbKey(id), store)]);
}

export const saveThumb = (id: string, dataUrl: string) => set(thumbKey(id), dataUrl, store);

export async function loadThumbs(ids: string[]): Promise<Record<string, string>> {
  const values = await getMany<string | undefined>(ids.map(thumbKey), store);
  const out: Record<string, string> = {};
  ids.forEach((id, i) => {
    if (values[i]) out[id] = values[i]!;
  });
  return out;
}

/** Ask the browser not to evict our data (matters most on iOS/Safari). */
export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persisted && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    /* not supported */
  }
}
