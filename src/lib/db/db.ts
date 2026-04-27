import Dexie, { type Table } from "dexie";
import type { Workspace, DatabaseTable, Field, RecordItem, Attachment, Settings, UrgentItem } from "../types";

class UnifiedDB extends Dexie {
  workspaces!: Table<Workspace, string>;
  tablesStore!: Table<DatabaseTable, string>;
  fields!: Table<Field, string>;
  records!: Table<RecordItem, string>;
  attachments!: Table<Attachment, string>;
  settings!: Table<Settings, string>;
  urgentItems!: Table<UrgentItem, string>;

  constructor() {
    super("unified_study_vault");

    this.version(10).stores({
      workspaces: "id, name, icon, favorite, archived, templateType, updatedAt",
      tablesStore: "id, workspaceId, name, updatedAt",
      fields: "id, tableId, workspaceId, order",
      records: "id, tableId, workspaceId, title, updatedAt",
      attachments: "id, ownerType, ownerId, hash",
      settings: "id",
      urgentItems: "id, priority, createdAt",

      // explicitly drop legacy tables
      spaces: null,
      recordValues: null,
      documents: null,
      attachmentBlobs: null,
      views: null,
      syncStates: null,
      exportJobs: null,
    });
  }
}

export const db = new UnifiedDB();

export const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? (crypto as any).randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
export const now = () => new Date().toISOString();

export async function sha256OfString(s: string): Promise<string> {
  if (typeof crypto !== "undefined" && (crypto as any).subtle) {
    const buf = new TextEncoder().encode(s);
    const hash = await (crypto as any).subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return "fb_" + Math.abs(h).toString(16) + "_" + s.length;
}
