import { db, now, uid, sha256OfString } from "./db";
import type { Attachment, AttachmentBlob, Field, RecordItem, Settings, Space, View } from "./types";
import { TEMPLATES, DEFAULT_SPACE_KEYS, buildSeedForTemplate } from "./templates";
import { history } from "./history";

const SETTINGS_KEY = "app";

/* ----------------------------- Settings ----------------------------- */

export async function getSettings(): Promise<Settings> {
  let s = await db.settings.get(SETTINGS_KEY);
  if (!s) {
    s = { id: "app", theme: "obsidianAtelier" };
    await db.settings.put(s);
  }
  return s;
}

export async function updateSettings(patch: Partial<Settings>) {
  const s = await getSettings();
  const next = { ...s, ...patch, id: "app" as const };
  await db.settings.put(next);
  return next;
}

/* ----------------------------- Spaces ------------------------------- */

export async function ensureSeed() {
  const count = await db.spaces.count();
  if (count > 0) return;
  for (const key of DEFAULT_SPACE_KEYS) {
    await createSpaceFromTemplate(key);
  }
}

export async function createSpaceFromTemplate(templateKey: string, overrides?: Partial<Space>): Promise<Space> {
  const tpl = TEMPLATES.find((t) => t.key === templateKey) ?? TEMPLATES[TEMPLATES.length - 1];
  const space: Space = {
    id: uid(),
    name: overrides?.name ?? tpl.name,
    icon: overrides?.icon ?? tpl.icon,
    description: overrides?.description ?? tpl.description,
    templateType: tpl.key,
    createdAt: now(),
    updatedAt: now(),
  };
  const seed = buildSeedForTemplate(space.id, tpl.key);
  const records: RecordItem[] = seed.records.map((r) => ({
    id: uid(),
    spaceId: space.id,
    title: r.title,
    values: r.values,
    createdAt: now(),
    updatedAt: now(),
  }));
  await db.transaction("rw", [db.spaces, db.fields, db.views, db.records], async () => {
    await db.spaces.put(space);
    await db.fields.bulkPut(seed.fields);
    await db.views.bulkPut(seed.views);
    if (records.length) await db.records.bulkPut(records);
  });
  return space;
}

export async function deleteSpace(spaceId: string) {
  const records = await db.records.where({ spaceId }).toArray();
  const recordIds = records.map((r) => r.id);
  // collect attachments for refcount cleanup
  const atts = recordIds.length ? await db.attachments.where("recordId").anyOf(recordIds).toArray() : [];
  await db.transaction("rw", [db.spaces, db.fields, db.records, db.documents, db.attachments, db.views], async () => {
    await db.spaces.delete(spaceId);
    await db.fields.where({ spaceId }).delete();
    await db.records.where({ spaceId }).delete();
    if (recordIds.length) {
      await db.documents.where("recordId").anyOf(recordIds).delete();
      await db.attachments.where("recordId").anyOf(recordIds).delete();
    }
    await db.views.where({ spaceId }).delete();
  });
  for (const a of atts) if (a.hash) await releaseBlob(a.hash);
}

export async function duplicateSpace(spaceId: string): Promise<Space | null> {
  const orig = await db.spaces.get(spaceId);
  if (!orig) return null;
  const copy: Space = { ...orig, id: uid(), name: orig.name + " Copy", createdAt: now(), updatedAt: now() };
  await db.spaces.put(copy);
  const origFields = await db.fields.where({ spaceId }).toArray();
  const fieldIdMap = new Map<string, string>();
  const newFields: Field[] = origFields.map((f) => {
    const newId = uid();
    fieldIdMap.set(f.id, newId);
    return { ...f, id: newId, spaceId: copy.id };
  });
  await db.fields.bulkPut(newFields);
  const origRecords = await db.records.where({ spaceId }).toArray();
  const newRecords: RecordItem[] = origRecords.map((r) => {
    const remapped: Record<string, unknown> = {};
    if (r.values) {
      for (const [fid, v] of Object.entries(r.values)) {
        const nid = fieldIdMap.get(fid);
        if (nid) remapped[nid] = v;
      }
    }
    return { ...r, id: uid(), spaceId: copy.id, values: remapped, createdAt: now(), updatedAt: now() };
  });
  await db.records.bulkPut(newRecords);
  const views = await db.views.where({ spaceId }).toArray();
  await db.views.bulkPut(views.map((v) => ({ ...v, id: uid(), spaceId: copy.id, visibleFieldIds: v.visibleFieldIds?.map((id) => fieldIdMap.get(id) ?? id), groupByFieldId: v.groupByFieldId ? fieldIdMap.get(v.groupByFieldId) : undefined })));
  return copy;
}

/* ----------------------------- Records ------------------------------ */

export async function createRecord(spaceId: string, title = "Untitled"): Promise<RecordItem> {
  const rec: RecordItem = {
    id: uid(), spaceId, title, createdAt: now(), updatedAt: now(), values: {},
  };
  await db.records.put(rec);
  await db.spaces.update(spaceId, { updatedAt: now() });
  history.push({
    label: "Add record",
    undo: async () => { await db.records.delete(rec.id); },
    redo: async () => { await db.records.put({ ...rec, updatedAt: now() }); },
  });
  return rec;
}

export async function updateRecord(id: string, patch: Partial<RecordItem>, opts: { skipHistory?: boolean } = {}) {
  const before = await db.records.get(id);
  if (!before) return;
  await db.records.update(id, { ...patch, updatedAt: now() });
  await db.spaces.update(before.spaceId, { updatedAt: now() });
  if (opts.skipHistory) return;
  // capture old field values that changed
  const changed: Partial<RecordItem> = {};
  for (const k of Object.keys(patch) as (keyof RecordItem)[]) {
    (changed as Record<string, unknown>)[k as string] = (before as unknown as Record<string, unknown>)[k as string];
  }
  history.push({
    label: "Edit record",
    undo: async () => { await db.records.update(id, { ...changed, updatedAt: now() }); },
    redo: async () => { await db.records.update(id, { ...patch, updatedAt: now() }); },
  }, "title:" + id);
}

export async function setRecordValue(recordId: string, fieldId: string, value: unknown) {
  const rec = await db.records.get(recordId);
  if (!rec) return;
  const prev = rec.values?.[fieldId];
  const values = { ...(rec.values ?? {}), [fieldId]: value };
  await db.records.update(recordId, { values, updatedAt: now() });
  await db.spaces.update(rec.spaceId, { updatedAt: now() });
  history.push({
    label: "Edit cell",
    undo: async () => {
      const r = await db.records.get(recordId);
      if (!r) return;
      const next = { ...(r.values ?? {}) };
      if (prev === undefined) delete next[fieldId]; else next[fieldId] = prev;
      await db.records.update(recordId, { values: next, updatedAt: now() });
    },
    redo: async () => {
      const r = await db.records.get(recordId);
      if (!r) return;
      await db.records.update(recordId, { values: { ...(r.values ?? {}), [fieldId]: value }, updatedAt: now() });
    },
  }, `cell:${recordId}:${fieldId}`);
}

export async function deleteRecord(id: string) {
  const rec = await db.records.get(id);
  if (!rec) return;
  const doc = await db.documents.get(id);
  const atts = await db.attachments.where({ recordId: id }).toArray();
  await db.records.delete(id);
  await db.documents.where({ recordId: id }).delete();
  await db.attachments.where({ recordId: id }).delete();
  for (const a of atts) if (a.hash) await releaseBlob(a.hash);
  await db.spaces.update(rec.spaceId, { updatedAt: now() });
  history.push({
    label: "Delete record",
    undo: async () => {
      await db.records.put({ ...rec, updatedAt: now() });
      if (doc) await db.documents.put(doc);
      for (const a of atts) {
        if (a.hash) await retainBlob(a.hash);
        await db.attachments.put(a);
      }
    },
    redo: async () => {
      await db.records.delete(id);
      await db.documents.where({ recordId: id }).delete();
      const a2 = await db.attachments.where({ recordId: id }).toArray();
      await db.attachments.where({ recordId: id }).delete();
      for (const a of a2) if (a.hash) await releaseBlob(a.hash);
    },
  });
}

export async function duplicateRecord(id: string) {
  const rec = await db.records.get(id);
  if (!rec) return;
  const copy: RecordItem = { ...rec, id: uid(), title: rec.title + " (copy)", createdAt: now(), updatedAt: now() };
  await db.records.put(copy);
  const doc = await db.documents.get(id);
  if (doc) await db.documents.put({ id: copy.id, recordId: copy.id, contentJson: doc.contentJson, updatedAt: now() });
  history.push({
    label: "Duplicate record",
    undo: async () => { await db.records.delete(copy.id); await db.documents.where({ recordId: copy.id }).delete(); },
    redo: async () => {
      await db.records.put(copy);
      if (doc) await db.documents.put({ id: copy.id, recordId: copy.id, contentJson: doc.contentJson, updatedAt: now() });
    },
  });
}

/* ----------------------------- Fields ------------------------------- */

export async function addField(spaceId: string, name: string, type: Field["type"]): Promise<Field> {
  const fields = await db.fields.where({ spaceId }).toArray();
  const f: Field = {
    id: uid(), spaceId, name, type, order: fields.length,
    options: type === "select" || type === "multiSelect" ? [] : undefined,
  };
  await db.fields.put(f);
  history.push({
    label: "Add field",
    undo: async () => { await db.fields.delete(f.id); },
    redo: async () => { await db.fields.put(f); },
  });
  return f;
}

export async function updateField(id: string, patch: Partial<Field>) {
  const before = await db.fields.get(id);
  if (!before) return;
  await db.fields.update(id, patch);
  const reverse: Partial<Field> = {};
  for (const k of Object.keys(patch) as (keyof Field)[]) {
    (reverse as Record<string, unknown>)[k as string] = (before as unknown as Record<string, unknown>)[k as string];
  }
  history.push({
    label: "Edit field",
    undo: async () => { await db.fields.update(id, reverse); },
    redo: async () => { await db.fields.update(id, patch); },
  });
}

export async function deleteField(id: string) {
  const f = await db.fields.get(id);
  if (!f) return;
  // snapshot all values that reference this field for undo
  const records = await db.records.where({ spaceId: f.spaceId }).toArray();
  const snapshot: { id: string; value: unknown }[] = [];
  for (const r of records) {
    if (r.values && id in r.values) snapshot.push({ id: r.id, value: r.values[id] });
  }
  await db.fields.delete(id);
  for (const r of records) {
    if (r.values && id in r.values) {
      const next = { ...r.values };
      delete next[id];
      await db.records.update(r.id, { values: next });
    }
  }
  history.push({
    label: "Delete field",
    undo: async () => {
      await db.fields.put(f);
      for (const s of snapshot) {
        const r = await db.records.get(s.id);
        if (!r) continue;
        await db.records.update(s.id, { values: { ...(r.values ?? {}), [id]: s.value } });
      }
    },
    redo: async () => {
      await db.fields.delete(id);
      const rs = await db.records.where({ spaceId: f.spaceId }).toArray();
      for (const r of rs) {
        if (r.values && id in r.values) {
          const next = { ...r.values };
          delete next[id];
          await db.records.update(r.id, { values: next });
        }
      }
    },
  });
}

/* --------------------------- Documents ------------------------------ */

export async function getDocument(recordId: string) {
  return db.documents.get(recordId);
}
export async function setDocument(recordId: string, contentJson: unknown) {
  const before = await db.documents.get(recordId);
  await db.documents.put({ id: recordId, recordId, contentJson, updatedAt: now() });
  history.push({
    label: "Edit notes",
    undo: async () => {
      if (before) await db.documents.put(before);
      else await db.documents.delete(recordId);
    },
    redo: async () => { await db.documents.put({ id: recordId, recordId, contentJson, updatedAt: now() }); },
  }, `doc:${recordId}`);
}

/* --------------------------- Attachments ---------------------------- */

export async function listAttachments(recordId: string) {
  return db.attachments.where({ recordId }).toArray();
}

async function retainBlob(hash: string) {
  const b = await db.attachmentBlobs.get(hash);
  if (b) await db.attachmentBlobs.update(hash, { refCount: b.refCount + 1 });
}

async function releaseBlob(hash: string) {
  const b = await db.attachmentBlobs.get(hash);
  if (!b) return;
  const next = Math.max(0, b.refCount - 1);
  if (next === 0) await db.attachmentBlobs.delete(hash);
  else await db.attachmentBlobs.update(hash, { refCount: next });
}

export async function addAttachment(recordId: string, file: File): Promise<void> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
  const hash = await sha256OfString(dataUrl);
  const existing = await db.attachmentBlobs.get(hash);
  if (existing) {
    await db.attachmentBlobs.update(hash, { refCount: existing.refCount + 1 });
  } else {
    const blob: AttachmentBlob = { hash, dataUrl, mimeType: file.type, size: file.size, refCount: 1 };
    await db.attachmentBlobs.put(blob);
  }
  const att: Attachment = {
    id: uid(), recordId, name: file.name, mimeType: file.type, size: file.size, hash, createdAt: now(),
  };
  await db.attachments.put(att);
}

export async function removeAttachment(id: string) {
  const a = await db.attachments.get(id);
  if (!a) return;
  await db.attachments.delete(id);
  if (a.hash) await releaseBlob(a.hash);
}

export async function getAttachmentDataUrl(att: Attachment): Promise<string | undefined> {
  if (att.dataUrl) return att.dataUrl;
  if (!att.hash) return undefined;
  const b = await db.attachmentBlobs.get(att.hash);
  return b?.dataUrl;
}

/** Storage usage broken down by kind. Sizes in bytes (approx for dataURL). */
export async function getStorageStats() {
  const blobs = await db.attachmentBlobs.toArray();
  const attachments = await db.attachments.toArray();
  const totalBlobBytes = blobs.reduce((s, b) => s + (b.size || b.dataUrl.length), 0);
  // referenced from existing attachments
  const referencedHashes = new Set(attachments.map((a) => a.hash).filter(Boolean) as string[]);
  const orphans = blobs.filter((b) => !referencedHashes.has(b.hash) || b.refCount === 0);
  const orphanBytes = orphans.reduce((s, b) => s + (b.size || b.dataUrl.length), 0);
  const dedupeSavings = attachments.reduce((s, a) => s + (a.size ?? 0), 0) - totalBlobBytes;
  let estQuota: number | undefined;
  let estUsage: number | undefined;
  if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
    try {
      const est = await navigator.storage.estimate();
      estQuota = est.quota; estUsage = est.usage;
    } catch { /* ignore */ }
  }
  return {
    blobCount: blobs.length,
    attachmentCount: attachments.length,
    totalBlobBytes,
    orphanCount: orphans.length,
    orphanBytes,
    dedupeSavings: Math.max(0, dedupeSavings),
    estQuota,
    estUsage,
  };
}

export async function cleanupOrphanAttachments(): Promise<number> {
  const blobs = await db.attachmentBlobs.toArray();
  const attachments = await db.attachments.toArray();
  const referenced = new Set(attachments.map((a) => a.hash).filter(Boolean) as string[]);
  const orphans = blobs.filter((b) => !referenced.has(b.hash) || b.refCount === 0);
  for (const o of orphans) await db.attachmentBlobs.delete(o.hash);
  return orphans.length;
}

/* --------------------------- Backup --------------------------------- */

export async function exportAllJSON() {
  const [spaces, fields, records, documents, attachments, blobs, views, settings] = await Promise.all([
    db.spaces.toArray(), db.fields.toArray(), db.records.toArray(),
    db.documents.toArray(), db.attachments.toArray(), db.attachmentBlobs.toArray(),
    db.views.toArray(), db.settings.toArray(),
  ]);
  await updateSettings({ lastBackupAt: now() });
  // inline data url for portability
  const blobByHash = new Map(blobs.map((b) => [b.hash, b]));
  const attachmentsExport = attachments.map((a) => ({
    ...a,
    dataUrl: a.dataUrl ?? (a.hash ? blobByHash.get(a.hash)?.dataUrl : undefined),
  }));
  return { version: 2, exportedAt: now(), spaces, fields, records, documents, attachments: attachmentsExport, attachmentBlobs: blobs, views, settings };
}

export async function importAllJSON(data: unknown) {
  if (!data || typeof data !== "object") throw new Error("Invalid backup file.");
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.spaces) || !Array.isArray(d.fields) || !Array.isArray(d.records)) {
    throw new Error("Backup is missing required sections.");
  }
  await db.transaction("rw", [db.spaces, db.fields, db.records, db.documents, db.attachments, db.attachmentBlobs, db.views, db.settings], async () => {
    await Promise.all([
      db.spaces.clear(), db.fields.clear(), db.records.clear(),
      db.documents.clear(), db.attachments.clear(), db.attachmentBlobs.clear(),
      db.views.clear(),
    ]);
    await db.spaces.bulkPut(d.spaces as Space[]);
    await db.fields.bulkPut(d.fields as Field[]);
    await db.records.bulkPut(d.records as RecordItem[]);
    if (Array.isArray(d.documents)) await db.documents.bulkPut(d.documents as never);
    if (Array.isArray(d.views)) await db.views.bulkPut(d.views as View[]);
    if (Array.isArray(d.settings) && d.settings[0]) await db.settings.put(d.settings[0] as Settings);
    // Attachments + blobs (re-dedupe in case of v1 backup with inline dataUrls)
    const incomingAtts = (d.attachments as (Attachment & { dataUrl?: string })[] | undefined) ?? [];
    const incomingBlobs = (d.attachmentBlobs as AttachmentBlob[] | undefined) ?? [];
    const blobMap = new Map<string, AttachmentBlob>();
    for (const b of incomingBlobs) blobMap.set(b.hash, { ...b, refCount: 0 });
    const finalAtts: Attachment[] = [];
    for (const a of incomingAtts) {
      let hash = a.hash;
      const dataUrl = a.dataUrl;
      if (!hash && dataUrl) hash = await sha256OfString(dataUrl);
      if (hash && dataUrl && !blobMap.has(hash)) {
        blobMap.set(hash, { hash, dataUrl, mimeType: a.mimeType, size: a.size ?? dataUrl.length, refCount: 0 });
      }
      if (hash && blobMap.has(hash)) blobMap.get(hash)!.refCount += 1;
      finalAtts.push({
        id: a.id, recordId: a.recordId, name: a.name, mimeType: a.mimeType,
        size: a.size, hash, createdAt: a.createdAt,
      });
    }
    if (finalAtts.length) await db.attachments.bulkPut(finalAtts);
    if (blobMap.size) await db.attachmentBlobs.bulkPut(Array.from(blobMap.values()));
  });
}

export async function exportSpaceCSV(spaceId: string): Promise<string> {
  const fields = (await db.fields.where({ spaceId }).toArray()).sort((a, b) => a.order - b.order);
  const records = await db.records.where({ spaceId }).toArray();
  const headers = ["Title", ...fields.map((f) => f.name), "Created", "Updated"];
  const rows = records.map((r) => {
    const vals = fields.map((f) => csvCell(formatValue(r.values?.[f.id], f)));
    return [csvCell(r.title), ...vals, csvCell(r.createdAt), csvCell(r.updatedAt)].join(",");
  });
  return [headers.map(csvCell).join(","), ...rows].join("\n");
}

function csvCell(v: string) {
  if (v == null) return "";
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function formatValue(v: unknown, f: Field): string {
  if (v == null || v === "") return "";
  if (f.type === "multiSelect" && Array.isArray(v)) {
    const opts = f.options ?? [];
    return v.map((id) => opts.find((o) => o.id === id)?.label ?? "").filter(Boolean).join(", ");
  }
  if (f.type === "select") {
    return f.options?.find((o) => o.id === v)?.label ?? "";
  }
  if (f.type === "checkbox") return v ? "true" : "false";
  return String(v);
}
