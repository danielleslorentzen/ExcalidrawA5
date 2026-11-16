const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const PagesIcon = (
  <svg {...base}>
    <rect x="6" y="3" width="13" height="18" rx="1.5" />
    <path d="M4 6v13a2 2 0 0 0 2 2" />
    <path d="M6 7h-2M6 11h-2M6 15h-2" />
  </svg>
);
export const PlusIcon = (
  <svg {...base}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const ChevronLeft = (
  <svg {...base}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);
export const ChevronRight = (
  <svg {...base}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);
export const ChevronDown = (
  <svg {...base} width={16} height={16}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);
export const MoreIcon = (
  <svg {...base}>
    <circle cx="5" cy="12" r="1" fill="currentColor" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
    <circle cx="19" cy="12" r="1" fill="currentColor" />
  </svg>
);
export const ScanIcon = (
  <svg {...base}>
    <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
    <path d="M4 12h16" />
  </svg>
);
export const PdfIcon = (
  <svg {...base}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </svg>
);
export const ImageIcon = (
  <svg {...base}>
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <circle cx="9" cy="9" r="1.5" />
    <path d="M20 15l-4-4-9 9" />
  </svg>
);
export const DownloadIcon = (
  <svg {...base}>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </svg>
);
export const UploadIcon = (
  <svg {...base}>
    <path d="M12 16V5M7 10l5-5 5 5M5 20h14" />
  </svg>
);
export const FileIcon = (
  <svg {...base}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </svg>
);
export const SectionIcon = (
  <svg {...base}>
    <path d="M5 4h10l4 4v12H5z" />
    <path d="M15 4v4h4" />
    <path d="M19 11h2v4h-2" />
  </svg>
);
export const CheckboxOnIcon = (
  <svg {...base}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="M8 12.5l2.5 2.5 5.5-6" />
  </svg>
);
export const CheckboxOffIcon = (
  <svg {...base}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
  </svg>
);
export const GripIcon = (
  <svg {...base} width={16} height={16}>
    <circle cx="9" cy="6" r="1" fill="currentColor" />
    <circle cx="15" cy="6" r="1" fill="currentColor" />
    <circle cx="9" cy="12" r="1" fill="currentColor" />
    <circle cx="15" cy="12" r="1" fill="currentColor" />
    <circle cx="9" cy="18" r="1" fill="currentColor" />
    <circle cx="15" cy="18" r="1" fill="currentColor" />
  </svg>
);
export const FocusIcon = (
  <svg {...base}>
    <path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" />
  </svg>
);
export const ExitFocusIcon = (
  <svg {...base}>
    <path d="M9 4v4a1 1 0 0 1-1 1H4M20 9h-4a1 1 0 0 1-1-1V4M15 20v-4a1 1 0 0 1 1-1h4M4 15h4a1 1 0 0 1 1 1v4" />
  </svg>
);
export const FullscreenIcon = (
  <svg {...base}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </svg>
);
export const FitWidthIcon = (
  <svg {...base}>
    <rect x="6" y="3" width="12" height="18" rx="1.5" />
    <path d="M2 12h4M18 12h4M4 10l-2 2 2 2M20 10l2 2-2 2" />
  </svg>
);
export const FitPageIcon = (
  <svg {...base}>
    <rect x="7" y="4" width="10" height="16" rx="1.5" />
    <path d="M3 8V3h5M21 8V3h-5M3 16v5h5M21 16v5h-5" />
  </svg>
);
export const SelectIcon = (
  <svg {...base}>
    <path d="M6 3l12 9-5.5 1.2L15 20l-2.5 1-2.6-6.6L6 18z" />
  </svg>
);
export const PenIcon = (
  <svg {...base}>
    <path d="M4 20l1.2-4.6L16 4.6a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8z" />
    <path d="M14 6.5l3.5 3.5" />
  </svg>
);
export const EraserIcon = (
  <svg {...base}>
    <path d="M8 20h12M5.5 15.5l9-9a2 2 0 0 1 2.8 0l1.2 1.2a2 2 0 0 1 0 2.8L11 18H8z" />
    <path d="M10 11l4 4" />
  </svg>
);
export const UndoIcon = (
  <svg {...base}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </svg>
);
export const RedoIcon = (
  <svg {...base}>
    <path d="M15 14l5-5-5-5" />
    <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
  </svg>
);
export const SearchIcon = (
  <svg {...base} width={16} height={16}>
    <circle cx="11" cy="11" r="6" />
    <path d="M20 20l-4.5-4.5" />
  </svg>
);
