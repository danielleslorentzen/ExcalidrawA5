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
export const SearchIcon = (
  <svg {...base} width={16} height={16}>
    <circle cx="11" cy="11" r="6" />
    <path d="M20 20l-4.5-4.5" />
  </svg>
);
