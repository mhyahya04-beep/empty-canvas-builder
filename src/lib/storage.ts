import { db, uid, now, sha256OfString } from "./db/db";
import type { RecordItem, DocumentContent, Attachment, Workspace, DatabaseTable, RecordValue } from "./types";
import { history } from "@/lib/history";

export async function createWorkspace(name: string): Promise<Workspace> {
  const id = uid();
  const w: Workspace = { id, name, createdAt: now(), updatedAt: now() } as any;
  await db.workspaces.put(w);
  // create a default table
  await createTable(w.id, `${name} — Table`);
  return w;
}

export async function createTable(workspaceId: string, name = "Table"): Promise<DatabaseTable> {
  const t: DatabaseTable = { id: uid(), workspaceId, name, createdAt: now(), updatedAt: now() } as any;
  await db.tablesStore.put(t);
  await db.workspaces.update(workspaceId, { updatedAt: now() } as any);
  return t;
}

export async function createRecord(tableId: string, title = "Untitled"): Promise<RecordItem> {
  const table = await db.tablesStore.get(tableId);
  const workspaceId = table?.workspaceId;
  const rec: RecordItem = { id: uid(), tableId, workspaceId, title, createdAt: now(), updatedAt: now(), values: {} } as any;
  await db.records.put(rec);
  if (workspaceId) await db.workspaces.update(workspaceId, { updatedAt: now() } as any);
  history.push({ label: "Add record", undo: async () => { await db.records.delete(rec.id); }, redo: async () => { await db.records.put({ ...rec, updatedAt: now() }); } });
  return rec;
}

export async function deleteRecord(recordId: string) {
  const rec = await db.records.get(recordId);
  if (!rec) return;
  const name = rec.title;
  // delete document
  await db.documents.delete(recordId);
  // delete attachments (use removeAttachment to handle blob refcounts)
  const atts = await db.attachments.where({ ownerType: 'record', ownerId: recordId }).toArray();
  for (const a of atts) await removeAttachment(a.id);
  // delete record values
  try { await db.recordValues.where({ recordId }).delete(); } catch (e) { /* ignore */ }
  // delete record
  await db.records.delete(recordId);
  if (rec.workspaceId) await db.workspaces.update(rec.workspaceId, { updatedAt: now() } as any);
  history.push({ label: "Delete record", undo: async () => {
    await db.records.put(rec);
  }, redo: async () => {
    await db.records.delete(recordId);
  } });
  return name;
}

export async function ensureSeed() {
  const count = await db.workspaces.count();
  if (count > 0) return;
  const workspace = await createWorkspace("Personal");
  const tables = await db.tablesStore.where({ workspaceId: workspace.id }).toArray();
  const table = tables[0];
  const f1 = { id: uid(), tableId: table.id, workspaceId: workspace.id, name: "Name", type: "text", order: 0 } as any;
  const f2 = { id: uid(), tableId: table.id, workspaceId: workspace.id, name: "Status", type: "select", options: [{ id: uid(), label: "Todo", color: "sage" }], order: 1 } as any;
  const rec: RecordItem = { id: uid(), tableId: table.id, workspaceId: workspace.id, title: "First note", createdAt: now(), updatedAt: now(), values: { [f1.id]: "First note", [f2.id]: f2.options[0].id } };
  await db.transaction("rw", [db.tablesStore, db.fields, db.records, db.views], async () => {
    await db.fields.bulkPut([f1, f2]);
    await db.records.put(rec as any);
  });
}

export async function getWorkspaces() { return db.workspaces.toArray(); }
export async function getDefaultTableForWorkspace(workspaceId: string) { const ts = await db.tablesStore.where({ workspaceId }).sortBy('createdAt'); return ts[0]; }
export async function getTablesForWorkspace(workspaceId: string) { return db.tablesStore.where({ workspaceId }).sortBy('createdAt'); }
export async function getFieldsForTable(tableId: string) { return db.fields.where({ tableId }).sortBy('order'); }
export async function getRecordsForTable(tableId: string) { return db.records.where({ tableId }).sortBy('createdAt'); }
export async function getRecord(id: string) { return (await db.records.get(id)) as unknown as RecordItem | undefined; }

export async function updateRecord(id: string, patch: Partial<RecordItem>, opts: { skipHistory?: boolean } = {}) {
  const before = await db.records.get(id);
  if (!before) return;
  await db.records.update(id, { ...patch, updatedAt: now() } as any);
  if (before.workspaceId) await db.workspaces.update(before.workspaceId, { updatedAt: now() } as any);
  if (opts.skipHistory) return;
  const changed: Partial<RecordItem> = {};
  for (const k of Object.keys(patch) as (keyof RecordItem)[]) { (changed as any)[k] = (before as any)[k]; }
  history.push({ label: "Edit record", undo: async () => { await db.records.update(id, { ...changed, updatedAt: now() } as any); }, redo: async () => { await db.records.update(id, { ...patch, updatedAt: now() } as any); } });
}

export async function addField(tableId: string, name: string, type: string) {
  const fields = await db.fields.where({ tableId }).toArray();
  const table = await db.tablesStore.get(tableId);
  const f: any = { id: uid(), tableId, workspaceId: table?.workspaceId, name, type, order: fields.length, options: type === "select" || type === "multiSelect" ? [] : undefined };
  await db.fields.put(f);
  history.push({ label: "Add field", undo: async () => { await db.fields.delete(f.id); }, redo: async () => { await db.fields.put(f); } });
  return f;
}

export async function updateField(id: string, patch: Partial<any>) {
  const before = await db.fields.get(id);
  if (!before) return;
  await db.fields.update(id, patch as any);
  const reverse: any = {};
  for (const k of Object.keys(patch) as string[]) { reverse[k] = (before as any)[k]; }
  history.push({ label: "Edit field", undo: async () => { await db.fields.update(id, reverse); }, redo: async () => { await db.fields.update(id, patch as any); } });
}

export async function deleteField(id: string) {
  const f = await db.fields.get(id);
  if (!f) return;
  const records = await db.records.where({ tableId: f.tableId }).toArray();
  const snapshot: { id: string; value: unknown }[] = [];
  for (const r of records) { if (r.values && id in r.values) snapshot.push({ id: r.id, value: r.values[id] }); }
  await db.fields.delete(id);
  for (const r of records) {
    if (r.values && id in r.values) {
      const next = { ...r.values } as Record<string, unknown>;
      delete next[id];
      await db.records.update(r.id, { values: next, updatedAt: now() } as any);
    }
  }
  history.push({ label: "Delete field", undo: async () => {
    await db.fields.put(f);
    for (const s of snapshot) {
      const r = await db.records.get(s.id);
      if (!r) continue;
      await db.records.update(s.id, { values: { ...(r.values ?? {}), [id]: s.value }, updatedAt: now() } as any);
    }
  }, redo: async () => {
    await db.fields.delete(id);
    const rs = await db.records.where({ tableId: f.tableId }).toArray();
    for (const r of rs) {
      if (r.values && id in r.values) {
        const next = { ...r.values } as Record<string, unknown>;
        delete next[id];
        await db.records.update(r.id, { values: next, updatedAt: now() } as any);
      }
    }
  } });
}

export async function setRecordValue(recordId: string, fieldId: string, value: unknown) {
  const rec = await db.records.get(recordId);
  if (!rec) return;
  const prev = rec.values?.[fieldId];

  // recordValues normalized store (id based on record+field to avoid duplicates)
  const rvId = `${recordId}:${fieldId}`;
  const nowStr = now();
  await db.recordValues.put({ id: rvId, recordId, fieldId, tableId: rec.tableId, value, createdAt: nowStr, updatedAt: nowStr } as RecordValue);

  // Keep compatibility snapshot on records.values for UI code that still reads it
  const values = { ...(rec.values ?? {}), [fieldId]: value };
  await db.records.update(recordId, { values, updatedAt: now() } as any);
  if (rec.workspaceId) await db.workspaces.update(rec.workspaceId, { updatedAt: now() } as any);

  history.push({ label: "Edit cell", undo: async () => {
    const r = await db.records.get(recordId);
    if (!r) return;
    const next = { ...(r.values ?? {}) } as Record<string, unknown>;
    if (prev === undefined) delete next[fieldId]; else next[fieldId] = prev;
    await db.records.update(recordId, { values: next, updatedAt: now() } as any);
    // revert normalized value
    if (prev === undefined) await db.recordValues.delete(rvId); else await db.recordValues.put({ id: rvId, recordId, fieldId, tableId: r.tableId, value: prev, createdAt: now(), updatedAt: now() } as any);
  }, redo: async () => {
    const r = await db.records.get(recordId);
    if (!r) return; await db.records.update(recordId, { values: { ...(r.values ?? {}), [fieldId]: value }, updatedAt: now() } as any);
    await db.recordValues.put({ id: rvId, recordId, fieldId, tableId: r.tableId, value, createdAt: now(), updatedAt: now() } as any);
  } }, `cell:${recordId}:${fieldId}`);
}

export async function getDocument(recordId: string) {
  return (await db.documents.get(recordId)) as unknown as DocumentContent | undefined;
}

export async function setDocument(recordId: string, contentJson: unknown) {
  const before = await db.documents.get(recordId);
  const rec = await db.records.get(recordId);
  await db.documents.put({ id: recordId, recordId, tableId: rec?.tableId, contentJson, updatedAt: now() } as DocumentContent);
  history.push({ label: "Edit notes", undo: async () => { if (before) await db.documents.put(before); else await db.documents.delete(recordId); }, redo: async () => { await db.documents.put({ id: recordId, recordId, tableId: rec?.tableId, contentJson, updatedAt: now() } as DocumentContent); } }, `doc:${recordId}`);
}

export async function addAttachment(recordId: string, file: File): Promise<void> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader(); fr.onload = () => resolve(fr.result as string); fr.onerror = () => reject(fr.error); fr.readAsDataURL(file);
  });
  const hash = await sha256OfString(dataUrl);
  const existing = await db.attachmentBlobs.get(hash);
  if (existing) {
    await db.attachmentBlobs.update(hash, { refCount: existing.refCount + 1 } as any);
  } else {
    const blob = { hash, dataUrl, mimeType: file.type, size: file.size, refCount: 1 } as any;
    await db.attachmentBlobs.put(blob);
  }
  const att: Attachment = { id: uid(), ownerType: 'record', ownerId: recordId, name: file.name, mimeType: file.type, size: file.size, hash, createdAt: now() } as any;
  await db.attachments.put(att as any);
}

export async function removeAttachment(id: string) {
  const a = await db.attachments.get(id) as Attachment | undefined;
  if (!a) return;
  await db.attachments.delete(id);
  if (a.hash) {
    const b = await db.attachmentBlobs.get(a.hash);
    if (!b) return;
    const next = Math.max(0, b.refCount - 1);
    if (next === 0) await db.attachmentBlobs.delete(a.hash); else await db.attachmentBlobs.update(a.hash, { refCount: next } as any);
  }
}

export async function listAttachments(recordId: string) {
  return db.attachments.where({ ownerType: 'record', ownerId: recordId }).toArray();
}

export async function getAttachmentDataUrl(att: Attachment): Promise<string | undefined> {
  if ((att as any).dataUrl) return (att as any).dataUrl;
  if (!att.hash) return undefined;
  const b = await db.attachmentBlobs.get(att.hash);
  return b?.dataUrl;
}

export async function getTable(tableId: string) { return (await db.tablesStore.get(tableId)) as unknown as DatabaseTable | undefined; }
export async function getWorkspace(workspaceId: string) { return (await db.workspaces.get(workspaceId)) as unknown as Workspace | undefined; }

// Urgent API
export async function getUrgentItems() { return db.urgentItems.orderBy('createdAt').reverse().toArray(); }
export async function getUrgentItem(id: string) { return db.urgentItems.get(id); }
// Views API
export async function getViewsForTable(tableId: string) { return db.views.where({ tableId }).sortBy('createdAt'); }
export async function createView(view: any) { const id = uid(); const v = { id, ...view, createdAt: now(), updatedAt: now() } as any; await db.views.put(v); return v; }
export async function updateView(id: string, patch: Partial<any>) { const before = await db.views.get(id); if (!before) return; await db.views.update(id, { ...patch, updatedAt: now() } as any); return await db.views.get(id); }
export async function deleteView(id: string) { await db.views.delete(id); }

// Duplicate a record: copy record, recordValues, and document. Attachments are referenced (refCount incremented)
export async function duplicateRecord(recordId: string) {
  const r = await db.records.get(recordId);
  if (!r) return undefined;
  const newId = uid();
  const rec: any = { ...r, id: newId, title: r.title + " (copy)", createdAt: now(), updatedAt: now() };
  // copy record values
  const rvs = await db.recordValues.where({ recordId }).toArray();
  const newRVs = rvs.map((rv: any) => ({ id: `${newId}:${rv.fieldId}`, recordId: newId, fieldId: rv.fieldId, tableId: rv.tableId, value: rv.value, createdAt: now(), updatedAt: now() }));
  // copy document
  const doc = await db.documents.get(recordId);
  await db.transaction('rw', [db.records, db.recordValues, db.documents, db.attachments, db.attachmentBlobs, db.workspaces], async () => {
    await db.records.put(rec as any);
    if (rec.workspaceId) await db.workspaces.update(rec.workspaceId, { updatedAt: now() } as any);
    if (newRVs.length) await db.recordValues.bulkPut(newRVs as any);
    if (doc) await db.documents.put({ ...doc, id: newId, recordId: newId, createdAt: now(), updatedAt: now() } as any);
    // duplicate attachments metadata by referencing same blobs (increment refCount)
    const atts = await db.attachments.where({ ownerType: 'record', ownerId: recordId }).toArray();
    for (const a of atts) {
      const newAtt = { ...a, id: uid(), ownerId: newId, createdAt: now() } as any;
      await db.attachments.put(newAtt);
      if (a.hash) {
        const b = await db.attachmentBlobs.get(a.hash);
        if (b) await db.attachmentBlobs.update(a.hash, { refCount: (b.refCount || 0) + 1 } as any);
      }
    }
  });
  history.push({ label: 'Duplicate record', undo: async () => { await db.records.delete(newId); }, redo: async () => { await db.records.put(rec as any); } });
  return rec as RecordItem;
}

// Field reordering helpers
export async function moveFieldLeft(fieldId: string) {
  const f = await db.fields.get(fieldId);
  if (!f) return;
  const fields = await db.fields.where({ tableId: f.tableId }).sortBy('order');
  const idx = fields.findIndex((x) => x.id === fieldId);
  if (idx <= 0) return;
  const before = fields[idx - 1];
  await db.fields.update(fieldId, { order: before.order } as any);
  await db.fields.update(before.id, { order: f.order } as any);
}
export async function moveFieldRight(fieldId: string) {
  const f = await db.fields.get(fieldId);
  if (!f) return;
  const fields = await db.fields.where({ tableId: f.tableId }).sortBy('order');
  const idx = fields.findIndex((x) => x.id === fieldId);
  if (idx === -1 || idx >= fields.length - 1) return;
  const after = fields[idx + 1];
  await db.fields.update(fieldId, { order: after.order } as any);
  await db.fields.update(after.id, { order: f.order } as any);
}

function _docHasUrgent(node: any): boolean {
  if (!node) return false;
  if (node.marks && Array.isArray(node.marks)) {
    for (const m of node.marks) { if (m.type === "highlight" && m.attrs && m.attrs.color === "urgent") return true; }
  }
  if (node.content && Array.isArray(node.content)) {
    for (const c of node.content) { if (_docHasUrgent(c)) return true; }
  }
  return false;
}

export async function ensureUrgentFromDoc(recordId: string, contentJson: any) {
  try {
    const hasUrgent = _docHasUrgent(contentJson);
    const existing = await db.urgentItems.where({ sourceType: 'record' }).toArray();
    const found = existing.find((e: any) => e.sourceRef && e.sourceRef.recordId === recordId);
    if (hasUrgent && !found) {
      const it: any = { id: uid(), sourceType: 'record', sourceRef: { recordId }, message: 'Urgent highlight', priority: 2, createdAt: now() };
      await db.urgentItems.put(it);
    } else if (!hasUrgent && found) {
      await db.urgentItems.delete(found.id);
    }
  } catch (e) {
    // non-fatal
    console.warn('ensureUrgentFromDoc error', e);
  }
}

export async function exportAll(): Promise<{ jobId: string; payload: any }> {
  const jobId = uid();
  const createdAt = now();
  await db.exportJobs.put({ id: jobId, status: 'running', progress: 0, createdAt } as any);
  const payload: any = {};
  payload.workspaces = await db.workspaces.toArray();
  payload.fields = await db.fields.toArray();
  payload.records = await db.records.toArray();
  payload.recordValues = await db.recordValues.toArray();
  payload.documents = await db.documents.toArray();
  payload.attachments = await db.attachments.toArray();
  payload.attachmentBlobs = await db.attachmentBlobs.toArray();
  payload.views = await db.views.toArray();
  payload.urgentItems = await db.urgentItems.toArray();
  payload.syncStates = await db.syncStates.toArray();
  payload.tables = await db.tablesStore.toArray();
  const finishedAt = now();
  await db.exportJobs.update(jobId, { status: 'success', progress: 100, finishedAt, fileUrl: undefined } as any);
  return { jobId, payload };
}

export async function createExportJob(payload: any) {
  const id = uid();
  await db.exportJobs.put({ id, status: 'pending', progress: 0, createdAt: now() } as any);
  return id;
}
