import { db, uid, now } from "./db/db";
import type { RecordItem, Workspace, DatabaseTable, Settings, Attachment, Field, UrgentItem } from "./types";
import { history } from "@/lib/history";
import { buildSeedForTemplate } from "./templates";

// --- Workspace API ---

export async function getWorkspaces(): Promise<Workspace[]> {
  return db.workspaces.toArray();
}

export async function getWorkspace(id: string): Promise<Workspace | undefined> {
  return db.workspaces.get(id);
}

export async function createWorkspace(name: string): Promise<Workspace> {
  const id = uid();
  const w: Workspace = { 
    id, 
    name, 
    createdAt: now(), 
    updatedAt: now() 
  };
  await db.workspaces.put(w);
  // Every workspace needs at least one table
  await createTable(id, `${name} — Table`);
  return w;
}

export async function updateWorkspace(id: string, patch: Partial<Workspace>): Promise<void> {
  await db.workspaces.update(id, { ...patch, updatedAt: now() });
}

export async function deleteWorkspace(id: string): Promise<void> {
  await db.transaction("rw", [db.workspaces, db.tablesStore, db.fields, db.records, db.attachments], async () => {
    const tables = await db.tablesStore.where({ workspaceId: id }).toArray();
    for (const table of tables) {
      await deleteTable(table.id);
    }
    await db.workspaces.delete(id);
  });
}

// --- Table API ---

export async function getTables(workspaceId: string): Promise<DatabaseTable[]> {
  return db.tablesStore.where({ workspaceId }).sortBy("createdAt");
}

export async function getTable(id: string): Promise<DatabaseTable | undefined> {
  return db.tablesStore.get(id);
}

export async function getDefaultTableForWorkspace(workspaceId: string): Promise<DatabaseTable | undefined> {
  const tables = await getTables(workspaceId);
  return tables[0];
}

export async function createTable(workspaceId: string, name = "Table"): Promise<DatabaseTable> {
  const id = uid();
  const t: DatabaseTable = { 
    id, 
    workspaceId, 
    name, 
    createdAt: now(), 
    updatedAt: now() 
  };
  await db.tablesStore.put(t);
  
  // Initialize with some default fields
  await db.fields.bulkPut([
    { id: uid(), tableId: id, workspaceId, name: "Status", type: "select", order: 0, options: [
      { id: uid(), label: "Not Started", color: "cream" },
      { id: uid(), label: "In Progress", color: "blue" },
      { id: uid(), label: "Done", color: "sage" }
    ] },
    { id: uid(), tableId: id, workspaceId, name: "Priority", type: "select", order: 1, options: [
      { id: uid(), label: "High", color: "rose" },
      { id: uid(), label: "Medium", color: "gold" },
      { id: uid(), label: "Low", color: "sage" }
    ] }
  ] as any);

  await updateWorkspace(workspaceId, {}); // Update timestamp
  return t;
}

export async function deleteTable(id: string): Promise<void> {
  await db.transaction("rw", [db.tablesStore, db.fields, db.records, db.attachments], async () => {
    await db.fields.where({ tableId: id }).delete();
    const records = await db.records.where({ tableId: id }).toArray();
    for (const record of records) {
      await deleteRecord(record.id);
    }
    await db.tablesStore.delete(id);
  });
}

// --- Field API ---

export async function addField(tableId: string, name: string, type: string = "text"): Promise<Field> {
  const table = await getTable(tableId);
  if (!table) throw new Error("Table not found");
  const id = uid();
  const f: Field = {
    id,
    tableId,
    workspaceId: table.workspaceId,
    name,
    type: type as any,
    order: await db.fields.where({ tableId }).count(),
  };
  await db.fields.put(f);
  return f;
}

export async function getFields(tableId: string): Promise<Field[]> {
  return db.fields.where({ tableId }).sortBy("order");
}

export async function createField(tableId: string, name: string, type: any): Promise<Field> {
  const table = await getTable(tableId);
  const fields = await getFields(tableId);
  const f: Field = {
    id: uid(),
    tableId,
    workspaceId: table?.workspaceId || "",
    name,
    type,
    order: fields.length,
    options: (type === "select" || type === "multiSelect") ? [] : undefined
  };
  await db.fields.put(f);
  return f;
}

export async function updateField(id: string, patch: Partial<Field>): Promise<void> {
  await db.fields.update(id, patch);
}

export async function deleteField(id: string): Promise<void> {
  await db.fields.delete(id);
}

// --- Record API (Unified Model) ---

export async function getRecords(tableId?: string): Promise<RecordItem[]> {
  if (tableId) {
    return db.records.where({ tableId }).toArray();
  }
  return db.records.toArray();
}

export async function getRecord(id: string): Promise<RecordItem | undefined> {
  return db.records.get(id);
}

export async function createRecord(tableId: string, title = "Untitled"): Promise<RecordItem> {
  const table = await getTable(tableId);
  if (!table) throw new Error("Table not found");

  const id = uid();
  const rec: RecordItem = {
    id,
    tableId,
    workspaceId: table.workspaceId,
    title,
    fields: {},
    documentContent: null,
    createdAt: now(),
    updatedAt: now()
  };

  await db.records.put(rec);
  await updateWorkspace(table.workspaceId, {}); // Update timestamp
  
  history.push({ 
    label: "Add record", 
    undo: async () => { await db.records.delete(id); }, 
    redo: async () => { await db.records.put(rec); } 
  });

  return rec;
}

export async function updateRecord(id: string, patch: Partial<RecordItem>): Promise<void> {
  const before = await db.records.get(id);
  if (!before) return;

  const next = { ...patch, updatedAt: now() };
  await db.records.update(id, next);
  
  if (before.workspaceId) {
    await updateWorkspace(before.workspaceId, {});
  }

  // Optional: history tracking
  // history.push({ ... });
}

export async function deleteRecord(id: string): Promise<void> {
  const rec = await db.records.get(id);
  if (!rec) return;

  await db.transaction("rw", [db.records, db.attachments, db.workspaces], async () => {
    await db.attachments.where({ ownerId: id }).delete();
    await db.records.delete(id);
    if (rec.workspaceId) {
      await updateWorkspace(rec.workspaceId, {});
    }
  });
}

// --- Attachment API (Basic) ---

export async function getAttachments(recordId: string): Promise<Attachment[]> {
  return db.attachments.where({ ownerId: recordId }).toArray();
}

export async function createAttachment(recordId: string, file: File): Promise<Attachment> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });

  const att: Attachment = {
    id: uid(),
    ownerType: 'record',
    ownerId: recordId,
    name: file.name,
    mimeType: file.type,
    size: file.size,
    dataUrl,
    createdAt: now()
  };

  await db.attachments.put(att);
  return att;
}

export async function deleteAttachment(id: string): Promise<void> {
  await db.attachments.delete(id);
}

// --- Settings API ---

const SETTINGS_KEY = "app";
export async function getSettings(): Promise<Settings> {
  let s = await db.settings.get(SETTINGS_KEY);
  if (!s) {
    s = { id: SETTINGS_KEY, theme: "ivoryWorkspace" as any };
    await db.settings.put(s);
  }
  return s;
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const s = await getSettings();
  const next = { ...s, ...patch, id: SETTINGS_KEY as any };
  await db.settings.put(next);
  return next;
}

// --- Seeding & Templates ---

export async function ensureSeed() {
  const count = await db.workspaces.count();
  if (count > 0) return;

  const { DEFAULT_SPACE_KEYS } = await import("./templates");
  for (const k of DEFAULT_SPACE_KEYS) {
    await createWorkspaceFromTemplate(k);
  }
}

export async function createWorkspaceFromTemplate(templateKey: string, overrides?: Partial<Workspace>): Promise<Workspace> {
  const { TEMPLATES } = await import("./templates");
  const tpl = TEMPLATES.find((t) => t.key === templateKey) ?? TEMPLATES[0];
  
  const workspaceId = uid();
  const workspace: Workspace = {
    id: workspaceId,
    name: overrides?.name ?? tpl.name,
    icon: (overrides as any)?.icon ?? tpl.icon,
    description: (overrides as any)?.description ?? tpl.description,
    templateType: tpl.key,
    createdAt: now(),
    updatedAt: now(),
  };

  const tableId = uid();
  const table: DatabaseTable = {
    id: tableId,
    workspaceId,
    name: `${workspace.name} — Table`,
    createdAt: now(),
    updatedAt: now(),
  };

  const seed = buildSeedForTemplate(workspaceId, tableId, tpl.key);
  
  const fields = seed.fields.map(f => ({ ...f, tableId }));
  const records = seed.records.map(r => ({
    id: uid(),
    workspaceId,
    tableId,
    title: r.title,
    fields: r.fields as any,
    documentContent: null,
    createdAt: now(),
    updatedAt: now(),
  }));

  await db.transaction("rw", [db.workspaces, db.tablesStore, db.fields, db.records], async () => {
    await db.workspaces.put(workspace);
    await db.tablesStore.put(table);
    await db.fields.bulkPut(fields as any);
    if (records.length) await db.records.bulkPut(records as any);
  });

  return workspace;
}

export async function ensureUrgentFromDoc(recordId: string, json: any) {
  // Logic to detect urgent items in doc (already partially implemented in urgent.ts)
}

export async function getUrgentItem(id: string) {
  const { buildUrgentIndex } = await import("./urgent");
  const items = await buildUrgentIndex();
  return items.find(it => it.id === id);
}

// --- Compatibility & Helper Exports ---
export const getFieldsForTable = getFields;
export const getRecordsForTable = getRecords;
export const getAttachmentsForRecord = getAttachments;
export const listAttachments = getAttachments;
export async function getAttachmentDataUrl(att: Attachment) { return att.dataUrl; }

export async function exportAllJSON() {
  const workspaces = await db.workspaces.toArray();
  const tables = await db.tablesStore.toArray();
  const fields = await db.fields.toArray();
  const records = await db.records.toArray();
  const attachments = await db.attachments.toArray();
  const settings = await db.settings.toArray();
  const { buildUrgentIndex } = await import("./urgent");
  const urgentItems = await buildUrgentIndex();
  return {
    version: 1,
    timestamp: now(),
    payload: {
      workspaces,
      tables,
      fields,
      records,
      attachments,
      settings,
      urgentItems
    }
  };
}
export const exportAll = exportAllJSON;

export async function importAllJSON(data: any) {
  const { payload } = data;
  if (!payload) throw new Error("Invalid backup format");
  await db.transaction("rw", [db.workspaces, db.tablesStore, db.fields, db.records, db.attachments, db.settings], async () => {
    await db.workspaces.clear();
    await db.tablesStore.clear();
    await db.fields.clear();
    await db.records.clear();
    await db.attachments.clear();
    await db.settings.clear();
    
    if (payload.workspaces) await db.workspaces.bulkPut(payload.workspaces);
    if (payload.tables) await db.tablesStore.bulkPut(payload.tables);
    if (payload.fields) await db.fields.bulkPut(payload.fields);
    if (payload.records) await db.records.bulkPut(payload.records);
    if (payload.attachments) await db.attachments.bulkPut(payload.attachments);
    if (payload.settings) await db.settings.bulkPut(payload.settings);
  });
}

export const deleteSpace = deleteWorkspace;
export const duplicateSpace = async (id: string) => {
  const space = await getWorkspace(id);
  if (!space) return null;
  const newSpace = await createWorkspace(`${space.name} (Copy)`);
  // Deep copy logic can be expanded here
  return newSpace;
};
export const exportSpaceCSV = async (id: string) => {
  // We'll use the real exporter for this
  const { exportTableCSV } = await import("./exporters");
  const tables = await getTables(id);
  if (tables.length > 0) return exportTableCSV(tables[0].id);
  return "";
};
export const addMockDataToAllWorkspaces = async () => {}; 
export const deduplicateWorkspacesAndRecords = async () => {}; 
export const toggleUrgentWorkspace = async (id: string) => {
  const ws = await db.workspaces.get(id);
  if (ws) {
    await db.workspaces.update(id, { urgent: !(ws as any).urgent, updatedAt: now() });
  }
};

export async function getStorageStats() {
  const attachmentCount = await db.attachments.count();
  const attachments = await db.attachments.toArray();
  let totalBlobBytes = 0;
  for (const a of attachments) {
    if (a.dataUrl) {
      // rough estimate of bytes from dataUrl
      const base64Length = a.dataUrl.split(',')[1]?.length ?? 0;
      totalBlobBytes += Math.floor(base64Length * 0.75);
    }
  }
  
  return {
    attachmentCount,
    blobCount: attachmentCount,
    totalBlobBytes,
    orphanCount: 0,
    orphanBytes: 0,
    dedupeSavings: 0,
    estUsage: totalBlobBytes,
    estQuota: 1024 * 1024 * 1024 // 1GB limit
  };
}

export async function cleanupOrphanAttachments() {
  const allAtts = await db.attachments.toArray();
  let removed = 0;
  for (const a of allAtts) {
    if (a.ownerType === 'record') {
      const exists = await db.records.get(a.ownerId);
      if (!exists) {
        await db.attachments.delete(a.id);
        removed++;
      }
    }
  }
  return removed;
}

export const duplicateRecord = async (id: string) => {
  const rec = await getRecord(id);
  if (!rec) return null;
  const newId = uid();
  const next: RecordItem = {
    ...rec,
    id: newId,
    title: `${rec.title} (Copy)`,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.records.put(next);
  return next;
};

export const setRecordValue = async (recordId: string, fieldId: string, value: any) => {
  const rec = await getRecord(recordId);
  if (rec) {
    const fields = { ...rec.fields, [fieldId]: value };
    await updateRecord(recordId, { fields });
  }
};
export const setDocument = async (id: string, content: any) => {
  await updateRecord(id, { documentContent: content });
};
export const toggleUrgentRecord = async (id: string) => {
  const rec = await db.records.get(id);
  if (rec) {
    await db.records.update(id, { urgent: !rec.urgent, updatedAt: now() });
  }
};

export const addAttachment = createAttachment;
export const removeAttachment = deleteAttachment;
export const getDocument = async (id: string) => {
  const rec = await getRecord(id);
  return rec ? { contentJson: rec.documentContent } : undefined;
};

