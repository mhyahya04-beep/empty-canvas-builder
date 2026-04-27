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
  | "relation"
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
  "rose",
  "sage",
  "mocha",
  "blue",
  "lavender",
  "cream",
  "blush",
  "gold",
  "terracotta",
  "charcoal",
];

export type MigrationSource = "target" | "vault" | "cookbook" | "bootstrap";

export type VaultDatabaseType =
  | "books"
  | "magazines"
  | "events"
  | "identity"
  | "notes"
  | "payment_methods"
  | "receipts"
  | "recipes"
  | "menus"
  | "ingredients"
  | "meal_plans"
  | "shopping_lists"
  | "social"
  | "documents"
  | "custom"
  | "reading_notes"
  | "contacts"
  | "people_notes"
  | "relationship_tags"
  | "quick_notes"
  | "study_notes"
  | "project_notes"
  | "knowledge";

export type VaultRecordType =
  | "book"
  | "magazine"
  | "event"
  | "identity"
  | "note"
  | "payment_method"
  | "receipt"
  | "recipe"
  | "menu"
  | "ingredient"
  | "meal_plan"
  | "shopping_list"
  | "social_contact"
  | "document"
  | "custom"
  | "reading_note"
  | "knowledge_item";

export interface FieldOption {
  id: string;
  label: string;
  color: TagColor;
}

export type EditorBlock = Record<string, unknown>;

export interface VaultField {
  id: string;
  key: string;
  workspaceId: string;
  databaseId: string;
  tableId: string;
  name: string;
  type: FieldType;
  options?: FieldOption[];
  order: number;
  required?: boolean;
  hidden?: boolean;
  sensitive?: boolean;
  width?: number;
  description?: string;
  relationTargetDatabaseTypes?: VaultDatabaseType[];
  relationAllowMultiple?: boolean;
}

export interface VaultWorkspace {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  databaseIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface VaultDatabase {
  id: string;
  workspaceId: string;
  name: string;
  type: VaultDatabaseType;
  fields: VaultField[];
  recordIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface VaultAttachment {
  id: string;
  recordId: string;
  ownerType?: "record" | "workspace" | "table";
  ownerId?: string;
  name: string;
  mimeType: string;
  size?: number;
  url?: string;
  localPath?: string;
  storageKey?: string;
  hash?: string;
  dataUrl?: string;
  order?: number;
  createdAt: string;
  source?: MigrationSource;
  sourceId?: string;
}

export interface VaultRecord {
  id: string;
  workspaceId: string;
  databaseId: string;
  tableId: string;
  title: string;
  type: VaultRecordType;
  properties: Record<string, unknown>;
  fields?: Record<string, unknown>;
  blocks: EditorBlock[];
  documentContent?: unknown;
  attachments: VaultAttachment[];
  tags: string[];
  isUrgent: boolean;
  isSensitive: boolean;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
  favorite?: boolean;
  urgent?: boolean;
  icon?: string;
  cover?: string;
  source?: MigrationSource;
  sourceId?: string;
  sourceUpdatedAt?: string;
  notes?: string;
}

export interface MigrationWarning {
  code: string;
  message: string;
  recordId?: string;
  attachmentId?: string;
}

export interface MigrationManifest {
  id: string;
  source: MigrationSource;
  sourceVersion?: string;
  status: "pending" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  workspaceIds: string[];
  databaseIds: string[];
  recordIds: string[];
  attachmentIds: string[];
  counts: {
    workspaces: number;
    databases: number;
    records: number;
    attachments: number;
    warnings: number;
    redactions: number;
    collisions: number;
  };
  warnings: MigrationWarning[];
  redactions: string[];
  collisions: string[];
  missingAttachments: string[];
  metadata?: Record<string, unknown>;
}

export interface Workspace extends VaultWorkspace {
  cover?: string;
  templateType?: string;
  archived?: boolean;
  favorite?: boolean;
  urgent?: boolean;
  order?: number;
}

export type Space = Workspace;

export interface DatabaseTable extends VaultDatabase {
  description?: string;
  archived?: boolean;
}

export interface Field extends VaultField {}

export interface RecordItem extends VaultRecord {}

export interface DocumentContent {
  id: string;
  recordId: string;
  tableId?: string;
  contentJson: unknown;
  updatedAt: string;
}

export interface Attachment extends VaultAttachment {}

export interface AttachmentBlob {
  hash: string;
  dataUrl: string;
  mimeType: string;
  size: number;
  refCount: number;
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
  lastMigrationRunAt?: string;
}

export interface DateValue {
  start: string;
  end?: string;
  hasTime?: boolean;
  tz?: string;
  format?: "FULL" | "MONTH_DAY_YEAR" | "DAY_MONTH_YEAR" | "ISO" | "DMY_SLASH" | "MDY_SLASH";
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
  recordTitle?: string;
  isSensitive?: boolean;
}
