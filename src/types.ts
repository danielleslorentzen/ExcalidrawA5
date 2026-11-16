import type { BinaryFiles } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

export type Orientation = "portrait" | "landscape";
export type Binding = "left" | "right" | "none";
export type Paper = "blank" | "dots" | "lines" | "grid";

export interface PageMeta {
  id: string;
  title: string;
  sectionId: string;
  orientation: Orientation;
  /** Which edge the discs go on — shown as a margin guide, not exported. */
  binding: Binding;
  /** On-screen ruling to match your paper — not exported. */
  paper: Paper;
  createdAt: number;
  updatedAt: number;
}

export interface Section {
  id: string;
  name: string;
  color: string;
  collapsed?: boolean;
}

export interface NotebookIndex {
  version: 1;
  sections: Section[];
  /** Pages in notebook order (sections group them, order within is kept). */
  pages: PageMeta[];
  lastPageId?: string;
}

export interface PageContent {
  elements: readonly ExcalidrawElement[];
  files: BinaryFiles;
}

export interface NotebookBackup {
  format: "a5excalidraw-notebook";
  version: 1;
  exportedAt: number;
  index: NotebookIndex;
  pages: Record<string, PageContent>;
}
