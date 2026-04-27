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

export interface Workspace {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  cover?: string;
  templateType?: string;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
  favorite?: boolean;
  urgent?: boolean;
  order?: number;
}

/** Alias for Workspace to maintain compatibility with legacy UI components */
export type Space = Workspace;

export interface DatabaseTable {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
}

export interface Field {
  id: string;
  workspaceId: string;
  tableId: string;
  name: string;
  type: FieldType;
  options?: FieldOption[];
  order: number;
  required?: boolean;
  hidden?: boolean;
  width?: number;
}

export interface RecordItem {
  id: string;
  workspaceId: string;
  tableId: string;
  title: string;
  icon?: string;
  cover?: string;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
  favorite?: boolean;
  urgent?: boolean;
  fields?: Record<string, unknown>;
  documentContent?: unknown; // Tiptap JSON content
}

export interface DocumentContent {
  id: string;
  recordId: string;
  tableId?: string;
  contentJson: unknown;
  updatedAt: string;
}

export interface Attachment {
  id: string;
  ownerType: 'record' | 'workspace' | 'table';
  ownerId: string;
  name: string;
  mimeType: string;
  size?: number;
  hash?: string;
  dataUrl?: string;
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
  workspaceId: string;
  tableId: string;
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
  | "vaultAtelier"
  | "midnightArchive"
  | "ivoryWorkspace"
  | "velvetStudio"
  | "clinicalScholar"
  | "libraryNoir"
  | "pastelGlass";

export type ThemeMode = "dark" | "light" | "system";

export type ThemeName = ThemeFamily;

export interface Settings {
  id: "app";
  theme: ThemeName;
  themeFamily?: ThemeFamily;
  themeMode?: ThemeMode;
  serifHeadings?: boolean;
  compactMode?: boolean;
  showUrgentSection?: boolean;
  includeArchivedUrgent?: boolean;
  sidebarCollapsed?: boolean;
  lastOpenedSpaceId?: string;
  lastBackupAt?: string;
  welcomed?: boolean;
}

export interface DateValue {
  start: string;
  end?: string;
  hasTime?: boolean;
  tz?: string;
  format?: 'FULL' | 'MONTH_DAY_YEAR' | 'DAY_MONTH_YEAR' | 'ISO' | 'DMY_SLASH' | 'MDY_SLASH';
}

export interface UrgentItem {
  id: string;
  sourceType: string;
  sourceRef: {
    recordId: string;
    workspaceId?: string;
    tableId?: string;
    fieldId?: string;
  };
  message: string;
  priority: number;
  createdAt: string;
  workspaceName?: string;
  tableName?: string;
}
