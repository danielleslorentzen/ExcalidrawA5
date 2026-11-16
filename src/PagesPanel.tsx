import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Binding, NotebookIndex, Orientation, PageMeta, Paper, Section } from "./types";
import { SECTION_COLORS } from "./storage";
import { pageLabel } from "./page";
import { ChevronDown, MoreIcon, PlusIcon, SearchIcon } from "./icons";

export interface PanelActions {
  openPage(id: string): void;
  addPage(sectionId: string): void;
  renamePage(id: string, title: string): void;
  duplicatePage(id: string): void;
  deletePage(id: string): void;
  movePage(id: string, dir: -1 | 1): void;
  movePageToSection(id: string, sectionId: string): void;
  updatePage(id: string, patch: Partial<Pick<PageMeta, "orientation" | "binding" | "paper">>): void;
  exportPagesPdf(ids: string[], name: string): void;
  addSection(): void;
  updateSection(id: string, patch: Partial<Section>): void;
  moveSection(id: string, dir: -1 | 1): void;
  deleteSection(id: string): void;
}

interface Props {
  index: NotebookIndex;
  currentPageId: string;
  thumbs: Record<string, string>;
  actions: PanelActions;
}

type MenuTarget = { kind: "page" | "section"; id: string } | null;

export function PagesPanel({ index, currentPageId, thumbs, actions }: Props) {
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<MenuTarget>(null);
  const [renaming, setRenaming] = useState<string | null>(null);

  const pagesBySection = useMemo(() => {
    const map = new Map<string, PageMeta[]>();
    for (const s of index.sections) map.set(s.id, []);
    for (const p of index.pages) map.get(p.sectionId)?.push(p);
    return map;
  }, [index]);

  const q = query.trim().toLowerCase();
  const matches = q ? index.pages.filter((p) => pageLabel(p).toLowerCase().includes(q)) : null;
  const sectionById = (id: string) => index.sections.find((s) => s.id === id);

  const card = (page: PageMeta, showSection = false) => (
    <PageCard
      key={page.id}
      page={page}
      section={showSection ? sectionById(page.sectionId) : undefined}
      thumb={thumbs[page.id]}
      current={page.id === currentPageId}
      renaming={renaming === page.id}
      menuOpen={menu?.kind === "page" && menu.id === page.id}
      onOpen={() => actions.openPage(page.id)}
      onMenu={() => setMenu({ kind: "page", id: page.id })}
      onRenameDone={(title) => {
        setRenaming(null);
        if (title !== null) actions.renamePage(page.id, title);
      }}
    >
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
    </PageCard>
  );

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
            <div className="a5-grid">{matches.map((p) => card(p, true))}</div>
          ) : (
            <p className="a5-empty">No pages match “{query}”.</p>
          )
        ) : (
          index.sections.map((section, i) => {
            const pages = pagesBySection.get(section.id) ?? [];
            return (
              <div key={section.id} className="a5-section" style={{ ["--tab" as string]: section.color }}>
                <div className="a5-section-head">
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
                    <span className="a5-count">{pages.length}</span>
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
                          disabled={!pages.length}
                          onClick={() => { setMenu(null); actions.exportPagesPdf(pages.map((p) => p.id), section.name); }}
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
                {!section.collapsed &&
                  (pages.length ? (
                    <div className="a5-grid">{pages.map((p) => card(p))}</div>
                  ) : (
                    <button className="a5-add-first" onClick={() => actions.addPage(section.id)}>
                      {PlusIcon} Add a page
                    </button>
                  ))}
              </div>
            );
          })
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

function PageCard(props: {
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
}) {
  const { page, section, thumb, current, renaming, menuOpen } = props;
  return (
    <div className={`a5-card ${current ? "is-current" : ""}`}>
      <button
        className={`a5-thumb is-${page.orientation}`}
        onClick={props.onOpen}
        title={pageLabel(page)}
        aria-current={current ? "page" : undefined}
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
