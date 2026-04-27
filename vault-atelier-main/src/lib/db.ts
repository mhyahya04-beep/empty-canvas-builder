import Dexie, { type Table } from "dexie";
import type {
  Space,
  Field,
  RecordItem,
  DocumentContent,
  Attachment,
  AttachmentBlob,
  View,
  Settings,
} from "./types";

class VaultDB extends Dexie {
  spaces!: Table<Space, string>;
  fields!: Table<Field, string>;
  records!: Table<RecordItem, string>;
  documents!: Table<DocumentContent, string>;
  attachments!: Table<Attachment, string>;
  attachmentBlobs!: Table<AttachmentBlob, string>;
  views!: Table<View, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super("vault_atelier");
    this.version(1).stores({
      spaces: "id, name, archived, favorite, updatedAt",
      fields: "id, spaceId, order",
      records: "id, spaceId, archived, updatedAt",
      documents: "id, recordId",
      attachments: "id, recordId",
      views: "id, spaceId",
      settings: "id",
    });
    // v2: extract attachment binary into a deduplicated blob store keyed by hash
    this.version(2).stores({
      attachments: "id, recordId, hash",
      attachmentBlobs: "hash",
    }).upgrade(async (tx) => {
      const blobsTable = tx.table<AttachmentBlob, string>("attachmentBlobs");
      const attsTable = tx.table<Attachment & { dataUrl?: string }, string>("attachments");
      const all = await attsTable.toArray();
      const blobMap = new Map<string, AttachmentBlob>();
      for (const a of all) {
        const dataUrl = a.dataUrl;
        if (!dataUrl) continue;
        const hash = await sha256OfString(dataUrl);
        if (!blobMap.has(hash)) {
          blobMap.set(hash, { hash, dataUrl, size: a.size ?? dataUrl.length, mimeType: a.mimeType, refCount: 0 });
        }
        blobMap.get(hash)!.refCount += 1;
        await attsTable.put({
          id: a.id, recordId: a.recordId, name: a.name,
          mimeType: a.mimeType, size: a.size, hash, createdAt: a.createdAt,
        });
      }
      for (const b of blobMap.values()) await blobsTable.put(b);
    });
  }
}

export const db = new VaultDB();

export const uid = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36));

export const now = () => new Date().toISOString();

export async function sha256OfString(s: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = new TextEncoder().encode(s);
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // very basic fallback
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return "fb_" + Math.abs(h).toString(16) + "_" + s.length;
}
