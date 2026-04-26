import Dexie, { type Table } from "dexie";

class UnifiedDB extends Dexie {
  // Canonical stores
  workspaces!: Table<any, string>;
  // Use `tablesStore` to avoid colliding with Dexie's internal `tables` array property
  tablesStore!: Table<any, string>;
  fields!: Table<any, string>;
  records!: Table<any, string>;
  recordValues!: Table<any, string>;
  documents!: Table<any, string>;
  attachments!: Table<any, string>;
  attachmentBlobs!: Table<any, string>;
  views!: Table<any, string>;
  urgentItems!: Table<any, string>;
  syncStates!: Table<any, string>;
  exportJobs!: Table<any, string>;
  settings!: Table<any, string>;

  // legacy alias kept for migration step
  spaces!: Table<any, string>;

  constructor() {
    super("unified_study_vault");

    // original schema (v1)
    this.version(1).stores({
      spaces: "id, name, archived, favorite, updatedAt",
      fields: "id, spaceId, order",
      records: "id, spaceId, archived, updatedAt",
      documents: "id, recordId",
      attachments: "id, recordId",
      views: "id, spaceId",
      settings: "id",
    });

    // v2 added attachment blobs and hash index
    this.version(2).stores({
      attachments: "id, recordId, hash",
      attachmentBlobs: "hash",
    });

    // v3 introduces the canonical model: workspaces, tables, recordValues, urgentItems, sync/export jobs
    this.version(3).stores({
      // keep legacy 'spaces' here so we can read and migrate existing data
      spaces: "id, name, archived, favorite, updatedAt",

      // new canonical stores
      workspaces: "id, name, updatedAt",
      tables: "id, workspaceId, name, updatedAt",
      fields: "id, tableId, workspaceId, order",
      records: "id, tableId, workspaceId, title, updatedAt",
      recordValues: "id, recordId, fieldId, tableId",
      documents: "id, recordId, tableId, updatedAt",
      attachments: "id, ownerType, ownerId, hash",
      attachmentBlobs: "hash",
      views: "id, tableId, workspaceId",
      urgentItems: "id, sourceType, createdAt",
      syncStates: "id, provider, lastSyncedAt",
      exportJobs: "id, status, createdAt, finishedAt",
      settings: "id",
    }).upgrade(async () => {
      try {
        // migrate legacy spaces -> workspaces + tables
        const legacySpaces = await this.table("spaces").toArray();
        for (const s of legacySpaces) {
          const workspace = {
            id: s.id,
            name: s.name,
            icon: s.icon,
            description: s.description ?? undefined,
            createdAt: s.createdAt ?? new Date().toISOString(),
            updatedAt: s.updatedAt ?? new Date().toISOString(),
          };
          await this.table("workspaces").put(workspace);

          // create a default table for this workspace
          const tableId = `table:${s.id}`;
          const table = { id: tableId, workspaceId: workspace.id, name: s.name + " — Table", description: undefined, createdAt: workspace.createdAt, updatedAt: workspace.updatedAt };
          await this.table("tables").put(table);

          // migrate fields -> attach tableId & workspaceId
          const fs = await this.table("fields").where({ spaceId: s.id }).toArray();
          for (const f of fs) {
            await this.table("fields").update(f.id, { tableId: tableId, workspaceId: workspace.id } as any);
          }

          // migrate records -> add tableId & workspaceId
          const rs = await this.table("records").where({ spaceId: s.id }).toArray();
          for (const r of rs) {
            await this.table("records").update(r.id, { tableId: tableId, workspaceId: workspace.id } as any);
          }

          // migrate views -> attach tableId & workspaceId
          const vs = await this.table("views").where({ spaceId: s.id }).toArray();
          for (const v of vs) {
            await this.table("views").update(v.id, { tableId: tableId, workspaceId: workspace.id } as any);
          }
        }
      } catch (e) {
        // migration best-effort: log silently
        // console.error('migration error', e);
      }
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
