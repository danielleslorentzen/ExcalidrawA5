import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Binding, NotebookIndex, Orientation, PageMeta, Paper, Section } from "./types";
import { SECTION_COLORS } from "./storage";
import { pageLabel } from "./page";
import { ChevronDown, GripIcon, MoreIcon, PlusIcon, SearchIcon } from "./icons";

export interface PanelActions {
  openPage(id: string): void;
  addPage(sectionId: string): void;
  renamePage(id: string, title: string): void;
  duplicatePage(id: string): void;
  deletePage(id: string): void;
  movePage(id: string, dir: -1 | 1): void;
  movePageToSection(id: string, sectionId: string): void;
  /** New page order, as page ids per section id. */
  reorderPages(layout: Layout): void;
  updatePage(id: string, patch: Partial<Pick<PageMeta, "orientation" | "binding" | "paper">>): void;
  exportPagesPdf(ids: string[], name: string): void;
  addSection(): void;
  updateSection(id: string, patch: Partial<Section>): void;
  moveSection(id: string, dir: -1 | 1): void;
  reorderSections(ids: string[]): void;
  deleteSection(id: string): void;
}

export type Layout = Record<string, string[]>;

interface Props {
  index: NotebookIndex;
  currentPageId: string;
  thumbs: Record<string, string>;
  actions: PanelActions;
}

type MenuTarget = { kind: "page" | "section"; id: string } | null;

/** Sections and pages share one drag context; section ids get a prefix to tell them apart. */
const SEC = "sec:";
const sectionDndId = (id: string) => SEC + id;
const isSectionDndId = (id: unknown) => String(id).startsWith(SEC);

const layoutsEqual = (a: Layout, b: Layout) =>
  Object.keys(a).length === Object.keys(b).length &&
  Object.keys(a).every((k) => b[k] && a[k].length === b[k].length && a[k].every((id, i) => b[k][i] === id));

export function PagesPanel({ index, currentPageId, thumbs, actions }: Props) {
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<MenuTarget>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  /** Live page layout while a page is being dragged (pages can hop between sections). */
  const [dragLayout, setDragLayout] = useState<Layout | null>(null);

  const baseLayout = useMemo<Layout>(() => {
    const out: Layout = Object.fromEntries(index.sections.map((s) => [s.id, []]));
    for (const p of index.pages) out[p.sectionId]?.push(p.id);
    return out;
  }, [index]);
  const layout = dragLayout ?? baseLayout;
  const pageById = useMemo(() => new Map(index.pages.map((p) => [p.id, p])), [index]);

  // Mouse: drag after moving 6px, so a plain click still opens the page.
  // Touch: press and hold for 250ms, so swiping still scrolls the list.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  const containerOf = (id: string) =>
    isSectionDndId(id) ? id.slice(SEC.length) : Object.keys(layout).find((k) => layout[k].includes(id));

  const draggingSection = dragging !== null && isSectionDndId(dragging);

  const collisionDetection: CollisionDetection = (args) => {
    if (draggingSection) {
      return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => isSectionDndId(c.id)) });
    }
    // Prefer the page card under the pointer; otherwise the section it's over.
    const hits = pointerWithin(args);
    const page = hits.find((h) => !isSectionDndId(h.id));
    if (page) return [page];
    if (hits.length) return [hits[0]];
    return closestCenter(args);
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    setMenu(null);
    setDragging(String(active.id));
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || isSectionDndId(active.id)) return;
    const id = String(active.id);
    const overId = String(over.id);
    const from = containerOf(id);
    const to = containerOf(overId);
    if (!from || !to || from === to) return;
    setDragLayout((prev) => {
      const cur = prev ?? baseLayout;
      const target = [...cur[to]];
      const at = isSectionDndId(overId) ? target.length : target.indexOf(overId);
      target.splice(at < 0 ? target.length : at, 0, id);
      return { ...cur, [from]: cur[from].filter((x) => x !== id), [to]: target };
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const id = String(active.id);
    if (isSectionDndId(id)) {
      if (over && over.id !== id) {
        const ids = index.sections.map((s) => sectionDndId(s.id));
        const to = ids.indexOf(String(over.id));
        if (to >= 0) actions.reorderSections(arrayMove(ids, ids.indexOf(id), to).map((x) => x.slice(SEC.length)));
      }
    } else {
      let final = layout;
      const section = containerOf(id);
      const overId = over ? String(over.id) : null;
      if (section && overId && overId !== id && layout[section].includes(overId)) {
        const list = layout[section];
        final = { ...layout, [section]: arrayMove(list, list.indexOf(id), list.indexOf(overId)) };
      }
      if (!layoutsEqual(final, baseLayout)) actions.reorderPages(final);
    }
    setDragging(null);
    setDragLayout(null);
  };

  const onDragCancel = () => {
    setDragging(null);
    setDragLayout(null);
  };

  const q = query.trim().toLowerCase();
  const matches = q ? index.pages.filter((p) => pageLabel(p).toLowerCase().includes(q)) : null;
  const sectionById = (id: string) => index.sections.find((s) => s.id === id);

  const cardProps = (page: PageMeta, showSection = false) => ({
    page,
    section: showSection ? sectionById(page.sectionId) : undefined,
    thumb: thumbs[page.id],
    current: page.id === currentPageId,
    renaming: renaming === page.id,
    menuOpen: menu?.kind === "page" && menu.id === page.id,
    onOpen: () => actions.openPage(page.id),
    onMenu: () => setMenu({ kind: "page", id: page.id }),
    onRenameDone: (title: string | null) => {
      setRenaming(null);
      if (title !== null) actions.renamePage(page.id, title);
    },
    children: (
      <PageMenu
        page={page}
        sections={index.sections}
        actions={actions}
        close={() => setMenu(null)}
        startRename={() => {
          setMenu(null);
          setRenaming(page.id);
        }}
      />
    ),
  });

  const draggedPage = dragging && !draggingSection ? pageById.get(dragging) : undefined;
  const draggedSection = draggingSection ? sectionById(dragging!.slice(SEC.length)) : undefined;

  return (
    <div className="a5-panel">
      <div className="a5-search">
        {SearchIcon}
        <input
          type="search"
          placeholder="Find a page…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="a5-panel-scroll">
        {matches ? (
          matches.length ? (
            <div className="a5-grid">
              {matches.map((p) => (
                <PageCard key={p.id} {...cardProps(p, true)} />
              ))}
            </div>
          ) : (
            <p className="a5-empty">No pages match “{query}”.</p>
          )
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onDragCancel={onDragCancel}
          >
            <SortableContext items={index.sections.map((s) => sectionDndId(s.id))} strategy={verticalListSortingStrategy}>
              {index.sections.map((section, i) => {
                const pageIds = layout[section.id] ?? [];
                const showPages = !section.collapsed && !draggingSection;
                return (
                  <SortableSection key={section.id} section={section}>
                    {(handle) => (
                      <>
                        <div className="a5-section-head">
                          <button
                            ref={handle.ref}
                            className="a5-icon-btn a5-grip"
                            title="Drag to reorder sections"
                            {...handle.attributes}
                            {...handle.listeners}
                          >
                            {GripIcon}
                          </button>
                          <button
                            className="a5-section-toggle"
                            onClick={() => actions.updateSection(section.id, { collapsed: !section.collapsed })}
                            aria-expanded={!section.collapsed}
                          >
                            <span className={`a5-caret ${section.collapsed ? "is-collapsed" : ""}`}>{ChevronDown}</span>
                            {renaming === section.id ? (
                              <InlineInput
                                initial={section.name}
                                onDone={(name) => {
                                  setRenaming(null);
                                  if (name) actions.updateSection(section.id, { name });
                                }}
                              />
                            ) : (
                              <span className="a5-section-name">{section.name}</span>
                            )}
                            <span className="a5-count">{pageIds.length}</span>
                          </button>
                          <button className="a5-icon-btn" title="Add page to this section" onClick={() => actions.addPage(section.id)}>
                            {PlusIcon}
                          </button>
                          <div className="a5-menu-anchor">
                            <button className="a5-icon-btn" title="Section options" onClick={() => setMenu({ kind: "section", id: section.id })}>
                              {MoreIcon}
                            </button>
                            {menu?.kind === "section" && menu.id === section.id && (
                              <Popover close={() => setMenu(null)}>
                                <MenuButton onClick={() => { setMenu(null); setRenaming(section.id); }}>Rename section</MenuButton>
                                <div className="a5-menu-row">
                                  {SECTION_COLORS.map((c) => (
                                    <button
                                      key={c}
                                      className={`a5-swatch ${c === section.color ? "is-active" : ""}`}
                                      style={{ background: c }}
                                      aria-label={`Tab colour ${c}`}
                                      onClick={() => actions.updateSection(section.id, { color: c })}
                                    />
                                  ))}
                                </div>
                                <MenuButton disabled={i === 0} onClick={() => actions.moveSection(section.id, -1)}>Move section up</MenuButton>
                                <MenuButton disabled={i === index.sections.length - 1} onClick={() => actions.moveSection(section.id, 1)}>Move section down</MenuButton>
                                <MenuButton
                                  disabled={!pageIds.length}
                                  onClick={() => { setMenu(null); actions.exportPagesPdf(pageIds, section.name); }}
                                >
                                  Export section as PDF
                                </MenuButton>
                                <MenuButton
                                  danger
                                  disabled={index.sections.length < 2}
                                  onClick={() => { setMenu(null); actions.deleteSection(section.id); }}
                                >
                                  Delete section…
                                </MenuButton>
                              </Popover>
                            )}
                          </div>
                        </div>
                        {showPages &&
                          (pageIds.length ? (
                            <SortableContext items={pageIds} strategy={rectSortingStrategy}>
                              <div className="a5-grid">
                                {pageIds.map((id) => {
                                  const page = pageById.get(id);
                                  return page ? <SortablePageCard key={id} {...cardProps(page)} /> : null;
                                })}
                              </div>
                            </SortableContext>
                          ) : (
                            <button className="a5-add-first" onClick={() => actions.addPage(section.id)}>
                              {PlusIcon} {dragging ? "Drop here" : "Add a page"}
                            </button>
                          ))}
                      </>
                    )}
                  </SortableSection>
                );
              })}
            </SortableContext>

            <DragOverlay dropAnimation={null}>
              {draggedPage ? (
                <div className="a5-drag-ghost">
                  <div className={`a5-thumb is-${draggedPage.orientation}`}>
                    {thumbs[draggedPage.id] ? <img src={thumbs[draggedPage.id]} alt="" /> : null}
                  </div>
                  <div className="a5-drag-title">{pageLabel(draggedPage)}</div>
                </div>
              ) : draggedSection ? (
                <div className="a5-drag-section" style={{ ["--tab" as string]: draggedSection.color }}>
                  {GripIcon}
                  <span>{draggedSection.name}</span>
                  <span className="a5-count">{baseLayout[draggedSection.id]?.length ?? 0}</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
        {!matches && (
          <button className="a5-add-section" onClick={actions.addSection}>
            {PlusIcon} New section
          </button>
        )}
      </div>
    </div>
  );
}

interface DragHandle {
  ref: (el: HTMLElement | null) => void;
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
}

function SortableSection({ section, children }: { section: Section; children: (handle: DragHandle) => ReactNode }) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: sectionDndId(section.id),
  });
  return (
    <div
      ref={setNodeRef}
      className={`a5-section ${isDragging ? "is-dragging" : ""}`}
      style={{ ["--tab" as string]: section.color, transform: CSS.Translate.toString(transform), transition }}
    >
      {children({ ref: setActivatorNodeRef, attributes, listeners })}
    </div>
  );
}

type PageCardProps = {
  page: PageMeta;
  section?: Section;
  thumb?: string;
  current: boolean;
  renaming: boolean;
  menuOpen: boolean;
  onOpen(): void;
  onMenu(): void;
  onRenameDone(title: string | null): void;
  children: ReactNode;
};

function SortablePageCard(props: PageCardProps) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: props.page.id });
  return (
    <PageCard
      {...props}
      cardRef={setNodeRef}
      dragging={isDragging}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      dragProps={{ ...attributes, ...listeners }}
    />
  );
}

function PageCard(
  props: PageCardProps & {
    cardRef?: (el: HTMLElement | null) => void;
    style?: CSSProperties;
    dragging?: boolean;
    dragProps?: object;
  },
) {
  const { page, section, thumb, current, renaming, menuOpen } = props;
  return (
    <div
      ref={props.cardRef}
      style={props.style}
      className={`a5-card ${current ? "is-current" : ""} ${props.dragging ? "is-dragging" : ""}`}
    >
      <button
        className={`a5-thumb is-${page.orientation}`}
        onClick={props.onOpen}
        title={pageLabel(page)}
        aria-current={current ? "page" : undefined}
        {...props.dragProps}
        aria-roledescription={props.dragProps ? "draggable page" : undefined}
      >
        {thumb ? <img src={thumb} alt="" draggable={false} /> : null}
      </button>
      <div className="a5-card-foot">
        {section && <span className="a5-dot" style={{ background: section.color }} title={section.name} />}
        {renaming ? (
          <InlineInput initial={page.title} onDone={(t) => props.onRenameDone(t)} />
        ) : (
          <button className="a5-card-title" onClick={props.onOpen}>
            {pageLabel(page)}
          </button>
        )}
        <div className="a5-menu-anchor">
          <button className="a5-icon-btn a5-small" title="Page options" onClick={props.onMenu}>
            {MoreIcon}
          </button>
          {menuOpen && props.children}
        </div>
      </div>
    </div>
  );
}

function PageMenu({
  page,
  sections,
  actions,
  close,
  startRename,
}: {
  page: PageMeta;
  sections: Section[];
  actions: PanelActions;
  close(): void;
  startRename(): void;
}) {
  const set = (patch: Partial<Pick<PageMeta, "orientation" | "binding" | "paper">>) => actions.updatePage(page.id, patch);
  return (
    <Popover close={close}>
      <MenuButton onClick={startRename}>Rename</MenuButton>
      <MenuButton onClick={() => { close(); actions.duplicatePage(page.id); }}>Duplicate</MenuButton>
      <div className="a5-menu-row">
        <MenuButton onClick={() => actions.movePage(page.id, -1)}>Move up</MenuButton>
        <MenuButton onClick={() => actions.movePage(page.id, 1)}>Move down</MenuButton>
      </div>
      {sections.length > 1 && (
        <label className="a5-menu-field">
          <span>Section</span>
          <select value={page.sectionId} onChange={(e) => actions.movePageToSection(page.id, e.target.value)}>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <Segmented<Orientation>
        label="Page"
        value={page.orientation}
        options={[["portrait", "Portrait"], ["landscape", "Landscape"]]}
        onChange={(orientation) => set({ orientation })}
      />
      <Segmented<Binding>
        label="Discs"
        value={page.binding}
        options={[["left", "Left"], ["right", "Right"], ["none", "None"]]}
        onChange={(binding) => set({ binding })}
      />
      <Segmented<Paper>
        label="Paper"
        value={page.paper}
        options={[["blank", "Blank"], ["dots", "Dots"], ["lines", "Lines"], ["grid", "Grid"]]}
        onChange={(paper) => set({ paper })}
      />
      <MenuButton onClick={() => { close(); actions.exportPagesPdf([page.id], page.title); }}>Export as PDF</MenuButton>
      <MenuButton danger onClick={() => { close(); actions.deletePage(page.id); }}>Delete page…</MenuButton>
    </Popover>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange(v: T): void;
}) {
  return (
    <div className="a5-menu-field">
      <span>{label}</span>
      <div className="a5-segmented" role="radiogroup" aria-label={label}>
        {options.map(([v, text]) => (
          <button key={v} role="radio" aria-checked={v === value} className={v === value ? "is-active" : ""} onClick={() => onChange(v)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * A menu anchored to its parent button, kept inside the viewport. On phones it
 * becomes a bottom sheet so it's always reachable with a thumb.
 */
function Popover({ close, children }: { close(): void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });
  const sheet = window.innerWidth < 600;

  useLayoutEffect(() => {
    const menu = ref.current;
    const anchor = menu?.parentElement;
    if (!menu || !anchor || sheet) return setStyle({});
    const a = anchor.getBoundingClientRect();
    const { width, height } = menu.getBoundingClientRect();
    const margin = 8;
    const left = Math.min(Math.max(margin, a.right - width), window.innerWidth - width - margin);
    const below = a.bottom + 4;
    const top = below + height <= window.innerHeight - margin ? below : Math.max(margin, a.top - height - 4);
    setStyle({ left, top });
  }, [sheet]);

  return (
    <>
      <div className={`a5-menu-scrim ${sheet ? "is-sheet" : ""}`} onClick={close} />
      <div
        ref={ref}
        className={`a5-menu ${sheet ? "is-sheet" : ""}`}
        style={style}
        role="menu"
        onKeyDown={(e) => e.key === "Escape" && close()}
      >
        {children}
      </div>
    </>
  );
}

function MenuButton({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: ReactNode;
  onClick(): void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button role="menuitem" className={`a5-menu-item ${danger ? "is-danger" : ""}`} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

function InlineInput({ initial, onDone }: { initial: string; onDone(value: string | null): void }) {
  const [value, setValue] = useState(initial);
  const finished = useRef(false);
  const finish = (v: string | null) => {
    if (finished.current) return;
    finished.current = true;
    onDone(v === null ? null : v.trim());
  };
  return (
    <input
      className="a5-inline-input"
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onFocus={(e) => e.target.select()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") finish(value);
        if (e.key === "Escape") finish(null);
      }}
      onBlur={() => finish(value)}
    />
  );
}
