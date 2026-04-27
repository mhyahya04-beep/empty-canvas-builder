import { db } from "@/lib/db/db";
import {
  getFields,
  getMigrationManifest,
  saveMigrationManifest,
  upsertPreparedRecord,
} from "@/lib/storage";
import type { Attachment, MigrationManifest, RecordItem, VaultRecordType } from "@/lib/types";
import { buildNamespacedId } from "@/lib/migration/shape";
import { buildSectionedBlocks, legacyBlocksToEditorBlocks, paragraphBlock } from "@/lib/migration/document";
import { getActiveStorage } from "@/lib/storage/active-storage";
import type { ContentItem } from "@/models/item";

const LEGACY_TARGET_MANIFEST_ID = "migration:target:legacy-items";

function resolveDestination(item: ContentItem): {
  workspaceName: string;
  databaseName: string;
  recordType: VaultRecordType;
} {
  switch (item.type) {
    case "pdf_library_item":
      return { workspaceName: "Library", databaseName: "Reading Notes", recordType: "reading_note" };
    case "note":
      return item.subjectId
        ? { workspaceName: "General Notes", databaseName: "Study Notes", recordType: "note" }
        : { workspaceName: "General Notes", databaseName: "Quick Notes", recordType: "note" };
    case "topic":
    case "subject":
    case "folder":
    case "resource_list":
    case "link_collection":
    default:
      return { workspaceName: "Personal Knowledge Vault", databaseName: "Knowledge Records", recordType: "knowledge_item" };
  }
}

function stringifyMetadataValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(stringifyMetadataValue).join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return "";
}

function buildMetadataLines(item: ContentItem, titleById: Map<string, string>): string[] {
  const lines: string[] = [];
  if (item.description) lines.push(item.description);
  if (item.source?.origin) lines.push(`Imported via ${item.source.origin}.`);
  if (item.source?.originalFilename) lines.push(`Original file: ${item.source.originalFilename}`);
  if (item.source?.url) lines.push(`Source URL: ${item.source.url}`);
  if (item.subjectId) lines.push(`Subject: ${titleById.get(item.subjectId) ?? item.subjectId}`);
  if (item.parentId) lines.push(`Parent: ${titleById.get(item.parentId) ?? item.parentId}`);
  if (item.metadata) {
    for (const [key, value] of Object.entries(item.metadata)) {
      const rendered = stringifyMetadataValue(value);
      if (rendered) lines.push(`${key}: ${rendered}`);
    }
  }
  return lines;
}

function collectLegacyAttachments(item: ContentItem): Attachment[] {
  const attachments: Attachment[] = [];
  const metadata = item.metadata && typeof item.metadata === "object" ? (item.metadata as Record<string, unknown>) : {};
  const attachmentSeeds: Array<{ name?: unknown; url?: unknown; localPath?: unknown; mimeType?: unknown }> = [];

  attachmentSeeds.push({
    name: item.source?.originalFilename,
    url: item.source?.url,
    mimeType: metadata.mimeType,
    localPath: metadata.filePath,
  });

  for (const key of ["url", "pdfUrl", "fileUrl", "coverUrl", "imageUrl"]) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      attachmentSeeds.push({ name: metadata.fileName ?? metadata.filename ?? `${item.title} ${key}`, url: value, mimeType: metadata.mimeType });
    }
  }

  const seen = new Set<string>();
  return attachmentSeeds
    .map((seed, index) => {
      const name = typeof seed.name === "string" && seed.name.trim() ? seed.name.trim() : `${item.title} attachment ${index + 1}`;
      const url = typeof seed.url === "string" && seed.url.trim() ? seed.url.trim() : undefined;
      const localPath = typeof seed.localPath === "string" && seed.localPath.trim() ? seed.localPath.trim() : undefined;
      const mimeType = typeof seed.mimeType === "string" && seed.mimeType.trim() ? seed.mimeType.trim() : url?.endsWith(".pdf") ? "application/pdf" : "application/octet-stream";
      const dedupeKey = [name, url ?? "", localPath ?? ""].join("|");
      if (!url && !localPath) return null;
      if (seen.has(dedupeKey)) return null;
      seen.add(dedupeKey);
      return {
        id: buildNamespacedId("target", "legacy-attachment", `${item.id}:${index}`),
        recordId: buildNamespacedId("target", "legacy-item", item.id),
        ownerId: buildNamespacedId("target", "legacy-item", item.id),
        ownerType: "record" as const,
        name,
        mimeType,
        url,
        localPath,
        createdAt: item.updatedAt,
        source: "target" as const,
        sourceId: item.id,
      } as Attachment;
    })
    .filter((attachment): attachment is Attachment => Boolean(attachment));
}

function buildLegacyProperties(item: ContentItem, titleById: Map<string, string>) {
  return {
    legacy_type: item.type,
    subject: item.subjectId ? titleById.get(item.subjectId) ?? item.subjectId : undefined,
    source: item.source?.origin ?? "manual",
    status: item.status,
    slug: item.slug,
    parent_id: item.parentId ?? undefined,
  };
}

async function resolveDatabase(workspaceName: string, databaseName: string) {
  const workspaces = await db.workspaces.toArray();
  const workspace = workspaces.find((candidate) => candidate.name === workspaceName);
  if (!workspace) throw new Error(`Missing workspace for migration: ${workspaceName}`);
  const databases = await db.tablesStore.where({ workspaceId: workspace.id }).toArray();
  const database = databases.find((candidate) => candidate.name === databaseName);
  if (!database) throw new Error(`Missing database for migration: ${workspaceName} / ${databaseName}`);
  return database;
}

function buildFallbackBlocks(item: ContentItem, titleById: Map<string, string>) {
  const sections = [
    {
      heading: "Summary",
      paragraphs: buildMetadataLines(item, titleById),
    },
  ];
  return buildSectionedBlocks(sections);
}

async function convertLegacyItem(item: ContentItem, titleById: Map<string, string>): Promise<RecordItem> {
  const destination = resolveDestination(item);
  const database = await resolveDatabase(destination.workspaceName, destination.databaseName);
  const fields = await getFields(database.id);
  const properties = buildLegacyProperties(item, titleById);
  const blocks = item.blocks.length > 0 ? legacyBlocksToEditorBlocks(item.blocks) : buildFallbackBlocks(item, titleById);

  for (const field of fields) {
    if (field.key === "status" && properties.status && !properties[field.key]) {
      properties[field.key] = properties.status;
    }
    if (field.key === "source" && properties.source && !properties[field.key]) {
      properties[field.key] = properties.source;
    }
    if (field.key === "subject" && properties.subject && !properties[field.key]) {
      properties[field.key] = properties.subject;
    }
  }

  if (blocks.length === 0) {
    blocks.push(paragraphBlock(item.description || item.title));
  }

  return {
    id: buildNamespacedId("target", "legacy-item", item.id),
    workspaceId: database.workspaceId,
    databaseId: database.id,
    tableId: database.id,
    title: item.title,
    type: destination.recordType,
    properties,
    fields: {},
    blocks,
    documentContent: undefined,
    attachments: collectLegacyAttachments(item),
    tags: [...item.tags],
    isUrgent: false,
    isSensitive: false,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    archived: item.archived,
    favorite: item.pinned,
    urgent: false,
    source: "target",
    sourceId: item.id,
    sourceUpdatedAt: item.updatedAt,
  };
}

export async function migrateLegacyTargetItems(): Promise<MigrationManifest> {
  const prior = await getMigrationManifest(LEGACY_TARGET_MANIFEST_ID);
  if (prior?.status === "completed") {
    return prior;
  }

  const storage = await getActiveStorage();
  const items = await storage.getAllItems();
  const titleById = new Map(items.map((item) => [item.id, item.title]));

  const manifest: MigrationManifest = {
    id: LEGACY_TARGET_MANIFEST_ID,
    source: "target",
    status: "pending",
    startedAt: new Date().toISOString(),
    workspaceIds: [],
    databaseIds: [],
    recordIds: [],
    attachmentIds: [],
    counts: {
      workspaces: 0,
      databases: 0,
      records: 0,
      attachments: 0,
      warnings: 0,
      redactions: 0,
      collisions: 0,
    },
    warnings: [],
    redactions: [],
    collisions: [],
    missingAttachments: [],
    metadata: { itemCount: items.length },
  };

  try {
    const touchedWorkspaceIds = new Set<string>();
    const touchedDatabaseIds = new Set<string>();

    for (const item of items) {
      const record = await convertLegacyItem(item, titleById);
      const saved = await upsertPreparedRecord(record);
      manifest.recordIds.push(saved.id);
      manifest.counts.records += 1;
      touchedWorkspaceIds.add(saved.workspaceId);
      touchedDatabaseIds.add(saved.databaseId);

      for (const attachment of saved.attachments) {
        manifest.attachmentIds.push(attachment.id);
      }
      manifest.counts.attachments += saved.attachments.length;
    }

    manifest.workspaceIds = Array.from(touchedWorkspaceIds);
    manifest.databaseIds = Array.from(touchedDatabaseIds);
    manifest.counts.workspaces = manifest.workspaceIds.length;
    manifest.counts.databases = manifest.databaseIds.length;
    manifest.status = "completed";
    manifest.completedAt = new Date().toISOString();
    await saveMigrationManifest(manifest);
    return manifest;
  } catch (error) {
    manifest.status = "failed";
    manifest.completedAt = new Date().toISOString();
    manifest.warnings.push({
      code: "legacy-target-import-failed",
      message: error instanceof Error ? error.message : "Unknown migration error",
    });
    manifest.counts.warnings = manifest.warnings.length;
    await saveMigrationManifest(manifest);
    throw error;
  }
}
