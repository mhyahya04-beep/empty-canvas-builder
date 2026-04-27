export type FieldType =
  | "text"
  | "longText"
  | "number"
  | "date"
  | "dateTime"
  | "select"
  | "multiSelect"
  | "status"
  | "checkbox"
  | "rating"
  | "url"
  | "email"
  | "phone"
  | "person"
  | "image"
  | "file"
  | "createdTime"
  | "updatedTime";

export type TagColor =
  | "rose"
  | "sage"
  | "mocha"
  | "blue"
  | "lavender"
  | "cream"
  | "blush"
  | "gold"
  | "terracotta"
  | "charcoal";

export const TAG_COLORS: TagColor[] = [
  "rose", "sage", "mocha", "blue", "lavender", "cream", "blush", "gold", "terracotta", "charcoal",
];

export interface FieldOption {
  id: string;
  label: string;
  color: TagColor;
}

export interface Space {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  cover?: string; // attachment id or built-in gradient key
  templateType?: string;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
  favorite?: boolean;
  /** order in sidebar / home grid */
  order?: number;
}

export interface Field {
  id: string;
  spaceId: string;
  name: string;
  type: FieldType;
  options?: FieldOption[];
  order: number;
  required?: boolean;
  hidden?: boolean;
  width?: number;
}

/** Stored value for a date or dateTime field. */
export interface DateValue {
  /** ISO date or datetime */
  start: string;
  /** Optional end (range) */
  end?: string;
  /** IANA timezone (e.g. "Asia/Bahrain") */
  tz?: string;
  /** True when stored as date+time */
  hasTime?: boolean;
  /** Display format token */
  format?: "FULL" | "MONTH_DAY_YEAR" | "DAY_MONTH_YEAR" | "ISO" | "DMY_SLASH" | "MDY_SLASH";
}

export interface RecordItem {
  id: string;
  spaceId: string;
  title: string;
  icon?: string;
  cover?: string;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
  favorite?: boolean;
  /** Per-record urgent flag (separate from urgent values inside fields) */
  urgent?: boolean;
  values?: Record<string, unknown>;
}

export interface DocumentContent {
  id: string;
  recordId: string;
  contentJson: unknown;
  updatedAt: string;
}

export interface Attachment {
  id: string;
  recordId: string;
  name: string;
  mimeType: string;
  size?: number;
  hash?: string;
  dataUrl?: string;
  /** Display order inside the record */
  order?: number;
  createdAt: string;
}

export interface AttachmentBlob {
  hash: string;
  dataUrl: string;
  mimeType: string;
  size: number;
  refCount: number;
}

export interface View {
  id: string;
  spaceId: string;
  name: string;
  type: "table" | "list" | "gallery" | "board" | "calendar";
  filters?: ViewFilter[];
  sorts?: ViewSort[];
  visibleFieldIds?: string[];
  groupByFieldId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ViewFilter {
  fieldId: string;
  op: "eq" | "neq" | "contains" | "gt" | "lt" | "isEmpty" | "notEmpty";
  value?: unknown;
}

export interface ViewSort {
  fieldId: string;
  direction: "asc" | "desc";
}

export type ThemeFamily =
  | "obsidianAtelier"
  | "pearlDesk"
  | "coquetteArchive"
  | "clinicalScholar"
  | "libraryNoir"
  | "pastelGlass";

export type ThemeMode = "dark" | "light" | "system";

/** Legacy single-key theme name kept for backward compatibility. */
export type ThemeName =
  | "obsidianAtelier"
  | "pearlDesk"
  | "coquetteArchive"
  | "clinicalScholar"
  | "libraryNoir"
  | "pastelGlass";

export interface Settings {
  id: "app";
  /** Legacy single theme key (kept for old data). */
  theme: ThemeName;
  /** New: chosen theme family */
  themeFamily?: ThemeFamily;
  /** New: chosen mode */
  themeMode?: ThemeMode;
  serifHeadings?: boolean;
  compactMode?: boolean;
  showUrgentSection?: boolean;
  includeArchivedUrgent?: boolean;
  sidebarCollapsed?: boolean;
  lastOpenedSpaceId?: string;
  lastBackupAt?: string;
  /** Set after the user has dismissed the welcome screen / chosen a path */
  welcomed?: boolean;
}
