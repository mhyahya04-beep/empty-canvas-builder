import { db, now, uid } from "./db/db";
import type {
  Attachment,
  DatabaseTable,
  Field,
  FieldOption,
  FieldType,
  MigrationManifest,
  RecordItem,
  Settings,
  UrgentItem,
  Workspace,
} from "./types";
import { history } from "@/lib/history";
import {
  CREATE_WORKSPACE_PRESETS,
  getWorkspacePresetByKey,
  getWorkspacePresetByName,
  mapOptionsToFieldOptions,
  REQUIRED_WORKSPACE_PRESETS,
  type DatabasePreset,
  type FieldPreset,
  type WorkspacePreset,
} from "@/features/vault/definitions";
import {
  buildDocumentContentFromBlocks,
  getRecordFieldValue,
  inferDatabaseType,
  inferFieldTypeFromValue,
  inferRecordType,
  normalizeFieldShape,
  normalizeRecordBlocks,
  normalizeRecordProperties,
  setRecordFieldValue,
  slugifyFieldKey,
} from "./migration/shape";

const SETTINGS_KEY = "app";

function cloneFieldOptions(options?: FieldOption[]): FieldOption[] | undefined {
  if (!options) return undefined;
  return options.map((option) => ({ ...option }));
}

function cloneAttachment(attachment: Attachment): Attachment {
  return { ...attachment };
}

function normalizeAttachmentForRecord(recordId: string, attachment: Attachment): Attachment {
  return {
    ...attachment,
    recordId,
    ownerId: attachment.ownerId ?? recordId,
    ownerType: attachment.ownerType ?? "record",
    createdAt: attachment.createdAt ?? now(),
    source: attachment.source ?? "target",
  };
}

async function syncAttachmentsForRecord(recordId: string, attachments: Attachment[]): Promise<void> {
  const nextAttachments = attachments.map((attachment) => normalizeAttachmentForRecord(recordId, attachment));
  const existingById = new Map<string, Attachment>();

  for (const attachment of await db.attachments.where({ recordId }).toArray()) {
    existingById.set(attachment.id, attachment);
  }
  for (const attachment of await db.attachments.where({ ownerId: recordId }).toArray()) {
    existingById.set(attachment.id, attachment);
  }

  if (nextAttachments.length > 0) {
    await db.attachments.bulkPut(nextAttachments);
  }

  const nextIds = new Set(nextAttachments.map((attachment) => attachment.id));
  const staleIds = Array.from(existingById.keys()).filter((id) => !nextIds.has(id));
  if (staleIds.length > 0) {
    await db.attachments.bulkDelete(staleIds);
  }
}

async function refreshWorkspaceShape(workspaceId: string): Promise<void> {
  const workspace = await db.workspaces.get(workspaceId);
  if (!workspace) return;
  const databases = await db.tablesStore.where({ workspaceId }).sortBy("createdAt");
  await db.workspaces.put({
    ...workspace,
    databaseIds: databases.map((database) => database.id),
    updatedAt: now(),
  });
}

async function refreshDatabaseShape(databaseId: string): Promise<void> {
  const database = await db.tablesStore.get(databaseId);
  if (!database) return;
  const fields = await db.fields.where({ tableId: databaseId }).sortBy("order");
  const records = await db.records.where({ tableId: databaseId }).toArray();
  await db.tablesStore.put({
    ...database,
    fields,
    recordIds: records.map((record) => record.id),
    updatedAt: now(),
  });
  await refreshWorkspaceShape(database.workspaceId);
}

function fieldPresetToField(database: DatabaseTable, preset: FieldPreset, order: number): Field {
  return normalizeFieldShape({
    id: uid(),
    key: preset.key,
    workspaceId: database.workspaceId,
    databaseId: database.id,
    tableId: database.id,
    name: preset.name,
    type: preset.type,
    order,
    required: preset.required,
    hidden: preset.hidden,
    sensitive: preset.sensitive,
    description: preset.description,
    relationTargetDatabaseTypes: preset.relationTargetDatabaseTypes,
    relationAllowMultiple: preset.relationAllowMultiple,
    options: mapOptionsToFieldOptions(preset.options),
  });
}

function createDatabaseRecord(workspaceId: string, preset: DatabasePreset, nameOverride?: string): DatabaseTable {
  const timestamp = now();
  return {
    id: uid(),
    workspaceId,
    name: nameOverride ?? preset.name,
    type: preset.type,
    fields: [],
    recordIds: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    description: preset.description,
  };
}

function createWorkspaceRecord(preset: WorkspacePreset, overrides?: Partial<Workspace>): Workspace {
  const timestamp = now();
  return {
    id: uid(),
    name: overrides?.name ?? preset.name,
    icon: overrides?.icon ?? preset.icon,
    description: overrides?.description ?? preset.description,
    databaseIds: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    favorite: overrides?.favorite,
    archived: overrides?.archived,
    urgent: overrides?.urgent,
    order: overrides?.order,
    templateType: preset.key,
    cover: overrides?.cover,
  };
}

function isForbiddenPaymentSecretName(value?: string): boolean {
  const normalized = (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!normalized) return false;
  return (
    normalized.includes("full card") ||
    normalized.includes("card number") ||
    normalized.includes("credit card number") ||
    normalized.includes("debit card number") ||
    normalized.includes("bank password") ||
    normalized.includes("security code") ||
    normalized.includes("backup code") ||
    normalized.includes("recovery code") ||
    normalized.includes("one time password") ||
    /(^| )(cvv|cvc|otp|password|passcode|pin)( |$)/.test(normalized)
  );
}

function sanitizeForbiddenPaymentSecrets(
  database: DatabaseTable,
  tableFields: Field[],
  properties: Record<string, unknown>,
  fieldValues: Record<string, unknown>,
): { properties: Record<string, unknown>; fields: Record<string, unknown> } {
  if (database.type !== "payment_methods") {
    return { properties, fields: fieldValues };
  }

  const nextProperties = { ...properties };
  const nextFields = { ...fieldValues };
  const fieldsById = new Map(tableFields.map((field) => [field.id, field]));

  for (const field of tableFields) {
    if (isForbiddenPaymentSecretName(field.key) || isForbiddenPaymentSecretName(field.name)) {
      delete nextProperties[field.key];
      delete nextFields[field.id];
    }
  }

  for (const key of Object.keys(nextProperties)) {
    if (isForbiddenPaymentSecretName(key)) {
      delete nextProperties[key];
    }
  }

  for (const [fieldId] of Object.entries(nextFields)) {
    const field = fieldsById.get(fieldId);
    if (!field) continue;
    if (isForbiddenPaymentSecretName(field.key) || isForbiddenPaymentSecretName(field.name)) {
      delete nextFields[fieldId];
    }
  }

  return { properties: nextProperties, fields: nextFields };
}

async function createWorkspaceFromPresetDefinition(
  preset: WorkspacePreset,
  overrides?: Partial<Workspace>,
): Promise<Workspace> {
  const workspace = createWorkspaceRecord(preset, overrides);
  const databases = preset.databases.map((databasePreset) => createDatabaseRecord(workspace.id, databasePreset));
  const fields = databases.flatMap((database) => {
    const presetDefinition = preset.databases.find((candidate) => candidate.name === database.name);
    return (presetDefinition?.fields ?? []).map((fieldPreset, index) => fieldPresetToField(database, fieldPreset, index));
  });

  await db.transaction("rw", [db.workspaces, db.tablesStore, db.fields], async () => {
    await db.workspaces.put({ ...workspace, databaseIds: databases.map((database) => database.id) });
    await db.tablesStore.bulkPut(databases);
    if (fields.length > 0) {
      await db.fields.bulkPut(fields);
    }
  });

  for (const database of databases) {
    await refreshDatabaseShape(database.id);
  }

  return (await db.workspaces.get(workspace.id)) ?? workspace;
}

async function ensurePresetDatabase(workspace: Workspace, preset: DatabasePreset): Promise<DatabaseTable> {
  const existingDatabases = await db.tablesStore.where({ workspaceId: workspace.id }).toArray();
  const existing = existingDatabases.find((database) => database.name === preset.name);
  if (!existing) {
    const created = createDatabaseRecord(workspace.id, preset);
    await db.tablesStore.put(created);
    const fields = preset.fields.map((fieldPreset, index) => fieldPresetToField(created, fieldPreset, index));
    if (fields.length > 0) await db.fields.bulkPut(fields);
    await refreshDatabaseShape(created.id);
    return (await db.tablesStore.get(created.id)) ?? created;
  }

  const existingFields = await db.fields.where({ tableId: existing.id }).sortBy("order");
  const fieldByKey = new Map(existingFields.map((field) => [field.key, field]));

  for (const [index, fieldPreset] of preset.fields.entries()) {
    const match = fieldByKey.get(fieldPreset.key);
    if (!match) {
      await db.fields.put(fieldPresetToField(existing, fieldPreset, index));
      continue;
    }

    const nextOptions = mapOptionsToFieldOptions(fieldPreset.options);
    const hasEmptyOptions = (match.type === "select" || match.type === "multiSelect") && (!match.options || match.options.length === 0);
    if (
      match.name !== fieldPreset.name ||
      match.type !== fieldPreset.type ||
      match.order !== index ||
      match.sensitive !== fieldPreset.sensitive ||
      (hasEmptyOptions && nextOptions)
    ) {
      await db.fields.put({
        ...match,
        name: fieldPreset.name,
        type: fieldPreset.type,
        order: index,
        sensitive: fieldPreset.sensitive,
        required: fieldPreset.required,
        hidden: fieldPreset.hidden,
        description: fieldPreset.description,
        options: hasEmptyOptions ? nextOptions : match.options,
        relationTargetDatabaseTypes: fieldPreset.relationTargetDatabaseTypes,
        relationAllowMultiple: fieldPreset.relationAllowMultiple,
      });
    }
  }

  if (existing.type !== preset.type) {
    await db.tablesStore.put({ ...existing, type: preset.type, updatedAt: now() });
  }

  await refreshDatabaseShape(existing.id);
  return (await db.tablesStore.get(existing.id)) ?? existing;
}

export async function ensureRequiredWorkspaceStructure(): Promise<void> {
  for (const preset of REQUIRED_WORKSPACE_PRESETS) {
    const existingWorkspaces = await db.workspaces.toArray();
    const existing = existingWorkspaces.find((workspace) => workspace.name === preset.name);
    const workspace = existing ?? (await createWorkspaceFromPresetDefinition(preset));
    for (const databasePreset of preset.databases) {
      await ensurePresetDatabase(workspace, databasePreset);
    }
    await refreshWorkspaceShape(workspace.id);
  }
}

export async function getWorkspaces(): Promise<Workspace[]> {
  return db.workspaces.orderBy("updatedAt").reverse().toArray();
}

export async function getWorkspace(id: string): Promise<Workspace | undefined> {
  return db.workspaces.get(id);
}

export async function createWorkspace(name: string): Promise<Workspace> {
  const customPreset: WorkspacePreset = {
    key: "custom-workspace",
    name,
    icon: "📁",
    description: "Custom workspace",
    databases: [
      {
        key: "custom-database",
        name: `${name} Database`,
        type: "custom",
        recordType: "custom",
        fields: [],
      },
    ],
  };
  return createWorkspaceFromPresetDefinition(customPreset, { name });
}

export async function updateWorkspace(id: string, patch: Partial<Workspace>): Promise<void> {
  const workspace = await db.workspaces.get(id);
  if (!workspace) return;
  await db.workspaces.put({
    ...workspace,
    ...patch,
    databaseIds: patch.databaseIds ?? workspace.databaseIds ?? [],
    updatedAt: now(),
  });
}

export async function deleteWorkspace(id: string): Promise<void> {
  await db.transaction("rw", [db.workspaces, db.tablesStore, db.fields, db.records, db.attachments], async () => {
    const databases = await db.tablesStore.where({ workspaceId: id }).toArray();
    for (const database of databases) {
      await deleteTable(database.id);
    }
    await db.workspaces.delete(id);
  });
}

export async function getTables(workspaceId: string): Promise<DatabaseTable[]> {
  return db.tablesStore.where({ workspaceId }).sortBy("createdAt");
}

export async function getTable(id: string): Promise<DatabaseTable | undefined> {
  return db.tablesStore.get(id);
}

export async function getDefaultTableForWorkspace(workspaceId: string): Promise<DatabaseTable | undefined> {
  const databases = await getTables(workspaceId);
  return databases[0];
}

export async function createTable(
  workspaceId: string,
  name = "Database",
  type: DatabaseTable["type"] = inferDatabaseType(name),
): Promise<DatabaseTable> {
  const database: DatabaseTable = {
    id: uid(),
    workspaceId,
    name,
    type,
    fields: [],
    recordIds: [],
    createdAt: now(),
    updatedAt: now(),
  };
  await db.tablesStore.put(database);
  await refreshWorkspaceShape(workspaceId);
  return (await db.tablesStore.get(database.id)) ?? database;
}

export async function deleteTable(id: string): Promise<void> {
  const database = await db.tablesStore.get(id);
  if (!database) return;
  await db.transaction("rw", [db.tablesStore, db.fields, db.records, db.attachments], async () => {
    const records = await db.records.where({ tableId: id }).toArray();
    for (const record of records) {
      await db.attachments.where({ recordId: record.id }).delete();
      await db.attachments.where({ ownerId: record.id }).delete();
      await db.records.delete(record.id);
    }
    await db.fields.where({ tableId: id }).delete();
    await db.tablesStore.delete(id);
  });
  await refreshWorkspaceShape(database.workspaceId);
}

export async function getFields(tableId: string): Promise<Field[]> {
  return db.fields.where({ tableId }).sortBy("order");
}

export async function addField(tableId: string, name: string, type: FieldType = "text"): Promise<Field> {
  return createField(tableId, name, type);
}

export async function createField(tableId: string, name: string, type: FieldType): Promise<Field> {
  const database = await getTable(tableId);
  if (!database) throw new Error("Database not found");
  const fields = await getFields(tableId);
  const field: Field = normalizeFieldShape({
    id: uid(),
    key: slugifyFieldKey(name),
    tableId,
    databaseId: tableId,
    workspaceId: database.workspaceId,
    name,
    type,
    order: fields.length,
    options: type === "select" || type === "multiSelect" ? [] : undefined,
  });
  await db.fields.put(field);
  await refreshDatabaseShape(tableId);
  return field;
}

export async function updateField(id: string, patch: Partial<Field>): Promise<void> {
  const field = await db.fields.get(id);
  if (!field) return;
  const next = normalizeFieldShape({
    ...field,
    ...patch,
    key: patch.key ?? field.key ?? slugifyFieldKey(patch.name ?? field.name),
    options: cloneFieldOptions(patch.options ?? field.options),
  });
  await db.fields.put(next);
  await refreshDatabaseShape(next.tableId);
}

export async function deleteField(id: string): Promise<void> {
  const field = await db.fields.get(id);
  if (!field) return;
  const records = await db.records.where({ tableId: field.tableId }).toArray();
  for (const record of records) {
    const nextProperties = { ...(record.properties ?? {}) };
    const nextFields = { ...(record.fields ?? {}) };
    delete nextProperties[field.key];
    delete nextFields[field.id];
    await db.records.put({
      ...record,
      properties: nextProperties,
      fields: nextFields,
      updatedAt: now(),
    });
  }
  await db.fields.delete(id);
  await refreshDatabaseShape(field.tableId);
}

export async function getRecords(tableId?: string): Promise<RecordItem[]> {
  if (tableId) {
    return db.records.where({ tableId }).toArray();
  }
  return db.records.toArray();
}

export async function getRecord(id: string): Promise<RecordItem | undefined> {
  return db.records.get(id);
}

export function getRecordPropertyValue(record: Partial<RecordItem>, field: Pick<Field, "id" | "key">): unknown {
  return getRecordFieldValue(record, field);
}

async function normalizeRecordForSave(record: Partial<RecordItem>): Promise<RecordItem> {
  if (!record.tableId) throw new Error("Record is missing a tableId");
  const database = await getTable(record.tableId);
  if (!database) throw new Error("Database not found");
  const tableFields = await getFields(record.tableId);
  const normalizedBlocks = normalizeRecordBlocks(record);
  const { properties, fields } = normalizeRecordProperties(record, tableFields);
  const sanitized = sanitizeForbiddenPaymentSecrets(database, tableFields, properties, fields);
  const type = record.type ?? inferRecordType(database.type);
  const isSensitive = record.isSensitive ?? (database.type === "identity" || database.type === "payment_methods");
  return {
    id: record.id ?? uid(),
    workspaceId: record.workspaceId ?? database.workspaceId,
    databaseId: record.databaseId ?? database.id,
    tableId: record.tableId,
    title: record.title?.trim() || "Untitled",
    type,
    properties: sanitized.properties,
    fields: sanitized.fields,
    blocks: normalizedBlocks,
    documentContent: buildDocumentContentFromBlocks(normalizedBlocks),
    attachments: Array.isArray(record.attachments) ? record.attachments.map(cloneAttachment) : [],
    tags: Array.isArray(record.tags) ? [...record.tags] : [],
    isUrgent: record.isUrgent ?? record.urgent ?? false,
    isSensitive,
    createdAt: record.createdAt ?? now(),
    updatedAt: record.updatedAt ?? now(),
    archived: record.archived ?? false,
    favorite: record.favorite ?? false,
    urgent: record.urgent ?? record.isUrgent ?? false,
    icon: record.icon,
    cover: record.cover,
    source: record.source ?? "target",
    sourceId: record.sourceId,
    sourceUpdatedAt: record.sourceUpdatedAt,
    notes: record.notes,
  };
}

export async function upsertPreparedRecord(record: Partial<RecordItem>): Promise<RecordItem> {
  const normalized = await normalizeRecordForSave(record);
  await db.transaction("rw", [db.records, db.attachments], async () => {
    await db.records.put(normalized);
    await syncAttachmentsForRecord(normalized.id, normalized.attachments ?? []);
  });
  await refreshDatabaseShape(normalized.tableId);
  return normalized;
}

export async function createRecord(tableId: string, title = "Untitled"): Promise<RecordItem> {
  const database = await getTable(tableId);
  if (!database) throw new Error("Database not found");

  const record = await normalizeRecordForSave({
    id: uid(),
    title,
    tableId,
    databaseId: tableId,
    workspaceId: database.workspaceId,
    properties: {},
    fields: {},
    blocks: [],
    attachments: [],
    tags: [],
    isUrgent: false,
    urgent: false,
    isSensitive: database.type === "identity" || database.type === "payment_methods",
    type: inferRecordType(database.type),
    createdAt: now(),
    updatedAt: now(),
  });

  await db.records.put(record);
  await refreshDatabaseShape(tableId);

  history.push({
    label: "Add record",
    undo: async () => {
      await db.records.delete(record.id);
      await refreshDatabaseShape(tableId);
    },
    redo: async () => {
      await db.records.put(record);
      await refreshDatabaseShape(tableId);
    },
  });

  return record;
}

export async function updateRecord(id: string, patch: Partial<RecordItem>): Promise<void> {
  const current = await db.records.get(id);
  if (!current) return;
  const normalized = await normalizeRecordForSave({
    ...current,
    ...patch,
    id: current.id,
    updatedAt: now(),
  });
  await db.records.put(normalized);
  await refreshDatabaseShape(normalized.tableId);
}

export async function deleteRecord(id: string): Promise<void> {
  const record = await db.records.get(id);
  if (!record) return;
  await db.transaction("rw", [db.records, db.attachments], async () => {
    await db.attachments.where({ recordId: id }).delete();
    await db.attachments.where({ ownerId: id }).delete();
    await db.records.delete(id);
  });
  await refreshDatabaseShape(record.tableId);
}

export async function duplicateRecord(id: string): Promise<RecordItem | null> {
  const record = await getRecord(id);
  if (!record) return null;
  const duplicated = await normalizeRecordForSave({
    ...record,
    id: uid(),
    title: `${record.title} (Copy)`,
    attachments: [],
    createdAt: now(),
    updatedAt: now(),
  });
  await db.records.put(duplicated);

  const attachments = await getAttachments(record.id);
  for (const attachment of attachments) {
    await db.attachments.put({
      ...attachment,
      id: uid(),
      recordId: duplicated.id,
      ownerId: duplicated.id,
      createdAt: now(),
    });
  }

  await refreshDatabaseShape(duplicated.tableId);
  return duplicated;
}

export async function setRecordValue(recordId: string, fieldId: string, value: unknown): Promise<void> {
  const record = await getRecord(recordId);
  const field = await db.fields.get(fieldId);
  if (!record || !field) return;
  const nextRecord = setRecordFieldValue(record, field, value);
  await updateRecord(recordId, nextRecord);
}

export async function setDocument(id: string, content: unknown): Promise<void> {
  await updateRecord(id, {
    documentContent: content,
    blocks: normalizeRecordBlocks({ documentContent: content }),
  });
}

export async function getDocument(id: string): Promise<{ contentJson: unknown } | undefined> {
  const record = await getRecord(id);
  if (!record) return undefined;
  return {
    contentJson: record.documentContent ?? buildDocumentContentFromBlocks(record.blocks ?? []),
  };
}

export async function getAttachments(recordId: string): Promise<Attachment[]> {
  const direct = await db.attachments.where({ recordId }).toArray();
  if (direct.length > 0) return direct.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const legacy = await db.attachments.where({ ownerId: recordId }).toArray();
  return legacy.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function createAttachment(recordId: string, file: File): Promise<Attachment> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const attachment: Attachment = {
    id: uid(),
    recordId,
    ownerId: recordId,
    ownerType: "record",
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    dataUrl,
    createdAt: now(),
    source: "target",
  };
  await db.attachments.put(attachment);
  return attachment;
}

export async function putAttachment(attachment: Attachment): Promise<void> {
  await db.attachments.put({
    ...attachment,
    ownerId: attachment.ownerId ?? attachment.recordId,
    ownerType: attachment.ownerType ?? "record",
  });
}

export async function deleteAttachment(id: string): Promise<void> {
  await db.attachments.delete(id);
}

export async function getAttachmentDataUrl(attachment: Attachment): Promise<string | undefined> {
  if (attachment.dataUrl) return attachment.dataUrl;
  const stored = await db.attachments.get(attachment.id);
  return stored?.dataUrl;
}

export async function listAttachments(recordId: string): Promise<Attachment[]> {
  return getAttachments(recordId);
}

export async function getSettings(): Promise<Settings> {
  const existing = await db.settings.get(SETTINGS_KEY);
  if (existing) return existing;
  const defaults: Settings = { id: SETTINGS_KEY, theme: "ivoryWorkspace" };
  await db.settings.put(defaults);
  return defaults;
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const next: Settings = { ...current, ...patch, id: SETTINGS_KEY };
  await db.settings.put(next);
  return next;
}

export async function ensureSeed(): Promise<void> {
  await ensureRequiredWorkspaceStructure();
}

export async function createWorkspaceFromTemplate(templateKey: string, overrides?: Partial<Workspace>): Promise<Workspace> {
  const preset = getWorkspacePresetByKey(templateKey) ?? getWorkspacePresetByName(overrides?.name ?? "");
  if (preset) {
    return createWorkspaceFromPresetDefinition(preset, overrides);
  }

  const genericPreset: WorkspacePreset = {
    key: templateKey,
    name: overrides?.name ?? templateKey,
    icon: overrides?.icon ?? "📁",
    description: overrides?.description ?? "Custom workspace",
    databases: [
      {
        key: "custom-database",
        name: `${overrides?.name ?? templateKey} Database`,
        type: "custom",
        recordType: "custom",
        fields: [],
      },
    ],
  };
  return createWorkspaceFromPresetDefinition(genericPreset, overrides);
}

export async function createWorkspaceFromPreset(presetKey: string, overrides?: Partial<Workspace>): Promise<Workspace> {
  const preset = getWorkspacePresetByKey(presetKey);
  if (!preset) throw new Error(`Unknown workspace preset: ${presetKey}`);
  return createWorkspaceFromPresetDefinition(preset, overrides);
}

export async function exportAllJSON() {
  const workspaces = await db.workspaces.toArray();
  const tables = await db.tablesStore.toArray();
  const fields = await db.fields.toArray();
  const records = await db.records.toArray();
  const attachments = await db.attachments.toArray();
  const settings = await db.settings.toArray();
  const manifests = await db.migrationManifests.toArray();
  return {
    version: 2,
    timestamp: now(),
    payload: {
      workspaces,
      tables,
      fields,
      records,
      attachments,
      settings,
      manifests,
    },
  };
}

export const exportAll = exportAllJSON;

export async function importAllJSON(data: { payload?: Record<string, unknown> }): Promise<void> {
  const payload = data.payload;
  if (!payload) throw new Error("Invalid backup format");

  await db.transaction(
    "rw",
    [db.workspaces, db.tablesStore, db.fields, db.records, db.attachments, db.settings, db.migrationManifests],
    async () => {
      await db.workspaces.clear();
      await db.tablesStore.clear();
      await db.fields.clear();
      await db.records.clear();
      await db.attachments.clear();
      await db.settings.clear();
      await db.migrationManifests.clear();

      if (Array.isArray(payload.workspaces)) await db.workspaces.bulkPut(payload.workspaces as Workspace[]);
      if (Array.isArray(payload.tables)) await db.tablesStore.bulkPut(payload.tables as DatabaseTable[]);
      if (Array.isArray(payload.fields)) await db.fields.bulkPut(payload.fields as Field[]);
      if (Array.isArray(payload.records)) await db.records.bulkPut(payload.records as RecordItem[]);
      if (Array.isArray(payload.attachments)) await db.attachments.bulkPut(payload.attachments as Attachment[]);
      if (Array.isArray(payload.settings)) await db.settings.bulkPut(payload.settings as Settings[]);
      if (Array.isArray(payload.manifests)) await db.migrationManifests.bulkPut(payload.manifests as MigrationManifest[]);
    },
  );
}

export async function ensureUrgentFromDoc(..._args: unknown[]): Promise<void> {
  const { refreshUrgentIndex } = await import("./urgent");
  await refreshUrgentIndex();
}

export async function getUrgentItem(id: string): Promise<UrgentItem | undefined> {
  const { buildUrgentIndex } = await import("./urgent");
  const items = await buildUrgentIndex();
  return items.find((item) => item.id === id);
}

export const getFieldsForTable = getFields;
export const getRecordsForTable = getRecords;
export const getAttachmentsForRecord = getAttachments;
export const deleteSpace = deleteWorkspace;

export const duplicateSpace = async (id: string) => {
  const workspace = await getWorkspace(id);
  if (!workspace) return null;

  const copy = await createWorkspace(`${workspace.name} (Copy)`);
  const sourceDatabases = await getTables(id);
  const targetDatabases = await getTables(copy.id);
  const targetDefault = targetDatabases[0];

  for (const sourceDatabase of sourceDatabases) {
    const createdDatabase =
      sourceDatabase === sourceDatabases[0] && targetDefault
        ? targetDefault
        : await createTable(copy.id, sourceDatabase.name, sourceDatabase.type);

    const fields = await getFields(sourceDatabase.id);
    if (createdDatabase === targetDefault) {
      const existingFields = await getFields(createdDatabase.id);
      for (const field of existingFields) {
        await deleteField(field.id);
      }
    }

    for (const field of fields) {
      await db.fields.put({
        ...field,
        id: uid(),
        tableId: createdDatabase.id,
        databaseId: createdDatabase.id,
        workspaceId: copy.id,
        options: cloneFieldOptions(field.options),
      });
    }

    const records = await getRecords(sourceDatabase.id);
    for (const record of records) {
      const createdRecord = await normalizeRecordForSave({
        ...record,
        id: uid(),
        workspaceId: copy.id,
        tableId: createdDatabase.id,
        databaseId: createdDatabase.id,
        attachments: [],
        createdAt: now(),
        updatedAt: now(),
      });
      await db.records.put(createdRecord);

      const attachments = await getAttachments(record.id);
      for (const attachment of attachments) {
        await db.attachments.put({
          ...attachment,
          id: uid(),
          recordId: createdRecord.id,
          ownerId: createdRecord.id,
          createdAt: now(),
        });
      }
    }

    await refreshDatabaseShape(createdDatabase.id);
  }

  await refreshWorkspaceShape(copy.id);
  return getWorkspace(copy.id);
};

export const exportSpaceCSV = async (id: string) => {
  const { exportTableCSV } = await import("./exporters");
  const databases = await getTables(id);
  if (databases.length === 0) return "";
  return exportTableCSV(databases[0].id);
};

export const addMockDataToAllWorkspaces = async () => {};
export const deduplicateWorkspacesAndRecords = async () => {};

export const toggleUrgentWorkspace = async (id: string) => {
  const workspace = await db.workspaces.get(id);
  if (!workspace) return;
  await db.workspaces.put({ ...workspace, urgent: !workspace.urgent, updatedAt: now() });
};

export const toggleUrgentRecord = async (id: string) => {
  const record = await db.records.get(id);
  if (!record) return;
  await updateRecord(id, {
    isUrgent: !record.isUrgent,
    urgent: !record.urgent,
  });
};

export const addAttachment = createAttachment;
export const removeAttachment = deleteAttachment;

export async function getStorageStats() {
  const attachments = await db.attachments.toArray();
  const totalBlobBytes = attachments.reduce((total, attachment) => {
    const encoded = attachment.dataUrl?.split(",")[1] ?? "";
    return total + Math.floor(encoded.length * 0.75);
  }, 0);
  return {
    attachmentCount: attachments.length,
    blobCount: attachments.length,
    totalBlobBytes,
    orphanCount: 0,
    orphanBytes: 0,
    dedupeSavings: 0,
    estUsage: totalBlobBytes,
    estQuota: 1024 * 1024 * 1024,
  };
}

export async function cleanupOrphanAttachments() {
  const attachments = await db.attachments.toArray();
  let removed = 0;
  for (const attachment of attachments) {
    const recordId = attachment.recordId || attachment.ownerId;
    if (!recordId) continue;
    const exists = await db.records.get(recordId);
    if (!exists) {
      await db.attachments.delete(attachment.id);
      removed += 1;
    }
  }
  return removed;
}

export async function saveMigrationManifest(manifest: MigrationManifest): Promise<void> {
  await db.migrationManifests.put(manifest);
  await updateSettings({ lastMigrationRunAt: now() });
}

export async function getMigrationManifest(id: string): Promise<MigrationManifest | undefined> {
  return db.migrationManifests.get(id);
}

export async function listMigrationManifests(): Promise<MigrationManifest[]> {
  return db.migrationManifests.orderBy("completedAt").reverse().toArray();
}

export async function deleteMigrationManifest(id: string): Promise<void> {
  await db.migrationManifests.delete(id);
}

export function createFieldOption(label: string, color = "sage" as const): FieldOption {
  return {
    id: uid(),
    label,
    color,
  };
}

export function derivePresetForCreateModal() {
  return CREATE_WORKSPACE_PRESETS;
}

export function deriveFieldPresetFromValue(key: string, value: unknown): FieldPreset {
  const type = inferFieldTypeFromValue(value);
  return {
    key,
    name: key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
    type,
  };
}

export const reindexWorkspace = refreshWorkspaceShape;
export const reindexDatabase = refreshDatabaseShape;
