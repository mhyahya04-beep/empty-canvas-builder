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
  createdAt: string;
  updatedAt: string;
}

export interface Field {
  id: string;
  tableId: string;
  workspaceId?: string;
  name: string;
  type: FieldType;
  options?: FieldOption[];
  order: number;
}

export interface RecordItem {
  id: string;
  tableId: string;
  workspaceId?: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  values?: Record<string, unknown>;
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
  // owner can be a record or a document; use ownerType/ownerId for canonical model
  ownerType?: 'record' | 'document' | string;
  ownerId?: string;
  name: string;
  mimeType: string;
  size?: number;
  hash?: string;
  dataUrl?: string;
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
  tableId?: string;
  workspaceId?: string;
  name: string;
  type: string;
  visibleFieldIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  id: "app";
  theme?: string;
}

export interface Workspace {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DatabaseTable {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecordValue {
  id: string;
  recordId: string;
  fieldId: string;
  tableId?: string;
  value: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface UrgentItem {
  id: string;
  sourceType: string; // 'record'|'field'|'cell'|'checklist'|'text'|'deadline'
  sourceRef: any; // { recordId?, fieldId?, cellId?, textRange?, deadline? }
  message?: string;
  priority?: number;
  createdAt: string;
  resolvedAt?: string;
  // optional context for UI
  workspaceId?: string;
  workspaceName?: string;
  tableId?: string;
  tableName?: string;
}

export interface SyncState {
  id: string;
  provider: string; // e.g. 'drive', 'tauri', 'indexeddb'
  localId?: string;
  remoteId?: string;
  status?: string;
  lastSyncedAt?: string;
}

export interface ExportJob {
  id: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  progress?: number;
  createdAt: string;
  finishedAt?: string;
  fileUrl?: string;
}
