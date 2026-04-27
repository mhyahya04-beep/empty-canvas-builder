import Dexie, { type Table } from "dexie";
import type {
  Attachment,
  DatabaseTable,
  Field,
  MigrationManifest,
  RecordItem,
  Settings,
  UrgentItem,
  Workspace,
} from "../types";
import {
  buildDocumentContentFromBlocks,
  inferDatabaseType,
  inferRecordType,
  isSensitiveDatabaseType,
  normalizeFieldShape,
  normalizeRecordBlocks,
  normalizeRecordProperties,
} from "../migration/shape";

class UnifiedDB extends Dexie {
  workspaces!: Table<Workspace, string>;
  tablesStore!: Table<DatabaseTable, string>;
  fields!: Table<Field, string>;
  records!: Table<RecordItem, string>;
  attachments!: Table<Attachment, string>;
  settings!: Table<Settings, string>;
  urgentItems!: Table<UrgentItem, string>;
  migrationManifests!: Table<MigrationManifest, string>;

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
      spaces: null,
      recordValues: null,
      documents: null,
      attachmentBlobs: null,
      views: null,
      syncStates: null,
      exportJobs: null,
    });

    this.version(11)
      .stores({
        workspaces: "id, name, favorite, archived, updatedAt",
        tablesStore: "id, workspaceId, type, name, updatedAt",
        fields: "id, tableId, databaseId, workspaceId, key, order",
        records: "id, tableId, databaseId, workspaceId, type, title, updatedAt, archived, isSensitive, source",
        attachments: "id, recordId, ownerId, hash, source",
        settings: "id",
        urgentItems: "id, priority, createdAt",
        migrationManifests: "id, source, status, completedAt",
        spaces: null,
        recordValues: null,
        documents: null,
        attachmentBlobs: null,
        views: null,
        syncStates: null,
        exportJobs: null,
      })
      .upgrade(async (trans) => {
        const workspacesTable = trans.table("workspaces");
        const databasesTable = trans.table("tablesStore");
        const fieldsTable = trans.table("fields");
        const recordsTable = trans.table("records");
        const attachmentsTable = trans.table("attachments");

        const existingDatabases = (await databasesTable.toArray()) as DatabaseTable[];
        const normalizedDatabases = new Map<string, DatabaseTable>();

        for (const database of existingDatabases) {
          const normalizedDatabase: DatabaseTable = {
            ...database,
            type: database.type ?? inferDatabaseType(database.name),
            fields: Array.isArray(database.fields) ? database.fields : [],
            recordIds: Array.isArray(database.recordIds) ? database.recordIds : [],
            createdAt: database.createdAt ?? database.updatedAt ?? now(),
            updatedAt: database.updatedAt ?? database.createdAt ?? now(),
          };
          normalizedDatabases.set(normalizedDatabase.id, normalizedDatabase);
          await databasesTable.put(normalizedDatabase);
        }

        const existingFields = (await fieldsTable.toArray()) as Field[];
        const fieldsByTableId = new Map<string, Field[]>();
        for (const field of existingFields) {
          const normalizedField = normalizeFieldShape({
            ...field,
            databaseId: field.databaseId ?? field.tableId,
          });
          await fieldsTable.put(normalizedField);
          const list = fieldsByTableId.get(normalizedField.tableId) ?? [];
          list.push(normalizedField);
          fieldsByTableId.set(normalizedField.tableId, list);
        }
        for (const list of fieldsByTableId.values()) {
          list.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
        }

        const existingRecords = (await recordsTable.toArray()) as RecordItem[];
        const recordIdsByTableId = new Map<string, string[]>();
        for (const record of existingRecords) {
          const database = normalizedDatabases.get(record.tableId);
          const databaseType = database?.type ?? inferDatabaseType(database?.name ?? "");
          const tableFields = fieldsByTableId.get(record.tableId) ?? [];
          const { properties, fields } = normalizeRecordProperties(record, tableFields);
          const blocks = normalizeRecordBlocks(record);
          const normalizedRecord: RecordItem = {
            ...record,
            databaseId: record.databaseId ?? record.tableId,
            tableId: record.tableId,
            type: record.type ?? inferRecordType(databaseType),
            properties,
            fields,
            blocks,
            documentContent: buildDocumentContentFromBlocks(blocks),
            attachments: Array.isArray(record.attachments) ? record.attachments : [],
            tags: Array.isArray(record.tags) ? record.tags : [],
            isUrgent: record.isUrgent ?? record.urgent ?? false,
            isSensitive: record.isSensitive ?? isSensitiveDatabaseType(databaseType),
            createdAt: record.createdAt ?? record.updatedAt ?? now(),
            updatedAt: record.updatedAt ?? record.createdAt ?? now(),
            source: record.source ?? "target",
          };
          await recordsTable.put(normalizedRecord);
          const list = recordIdsByTableId.get(normalizedRecord.tableId) ?? [];
          list.push(normalizedRecord.id);
          recordIdsByTableId.set(normalizedRecord.tableId, list);
        }

        const existingAttachments = (await attachmentsTable.toArray()) as Attachment[];
        for (const attachment of existingAttachments) {
          const normalizedAttachment: Attachment = {
            ...attachment,
            recordId: attachment.recordId ?? attachment.ownerId ?? "",
            ownerId: attachment.ownerId ?? attachment.recordId ?? "",
            ownerType: attachment.ownerType ?? "record",
            source: attachment.source ?? "target",
            createdAt: attachment.createdAt ?? now(),
          };
          await attachmentsTable.put(normalizedAttachment);
        }

        const existingWorkspaces = (await workspacesTable.toArray()) as Workspace[];
        for (const workspace of existingWorkspaces) {
          const databaseIds = existingDatabases
            .filter((database) => database.workspaceId === workspace.id)
            .map((database) => database.id);
          await workspacesTable.put({
            ...workspace,
            databaseIds,
            createdAt: workspace.createdAt ?? workspace.updatedAt ?? now(),
            updatedAt: workspace.updatedAt ?? workspace.createdAt ?? now(),
          });
        }

        for (const database of normalizedDatabases.values()) {
          const hydratedDatabase: DatabaseTable = {
            ...database,
            fields: fieldsByTableId.get(database.id) ?? [],
            recordIds: recordIdsByTableId.get(database.id) ?? [],
          };
          await databasesTable.put(hydratedDatabase);
        }
      });
  }
}

export const db = new UnifiedDB();

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? (crypto as Crypto).randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export const now = () => new Date().toISOString();

export async function sha256OfString(value: string): Promise<string> {
  if (typeof crypto !== "undefined" && "subtle" in crypto) {
    const buffer = new TextEncoder().encode(value);
    const hash = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(hash))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return `fb_${Math.abs(hash).toString(16)}_${value.length}`;
}
