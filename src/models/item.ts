import { z } from "zod";
import { BlockSchema } from "./block";

export const ItemTypeSchema = z.enum([
  "note",
  "pdf_library_item",
  "resource_list",
  "link_collection",
  "folder",
  "topic",
  "subject",
]);

export const ItemStatusSchema = z.enum(["draft", "imported", "curated", "archived"]);

export const SourceMetaSchema = z.object({
  origin: z.enum(["manual", "docx", "pdf", "link", "json_import"]).optional(),
  originalFilename: z.string().optional(),
  importedAt: z.string().optional(),
  url: z.string().optional(),
});

export const ContentItemSchema = z.object({
  id: z.string(),
  type: ItemTypeSchema,
  title: z.string(),
  slug: z.string(),
  subjectId: z.string().nullable(),
  parentId: z.string().nullable(),
  tags: z.array(z.string()),
  description: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: ItemStatusSchema,
  pinned: z.boolean(),
  archived: z.boolean(),
  source: SourceMetaSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
  blocks: z.array(BlockSchema),
});

export type ItemType = z.infer<typeof ItemTypeSchema>;
export type ItemStatus = z.infer<typeof ItemStatusSchema>;
export type SourceMeta = z.infer<typeof SourceMetaSchema>;
export type ContentItem = z.infer<typeof ContentItemSchema>;

export const SCHEMA_VERSION = 1;

export const ExportManifestSchema = z.object({
  schemaVersion: z.number(),
  exportedAt: z.string(),
  appName: z.string(),
  itemCount: z.number(),
});

export const ExportBundleSchema = z.object({
  manifest: ExportManifestSchema,
  items: z.array(ContentItemSchema),
});

export type ExportManifest = z.infer<typeof ExportManifestSchema>;
export type ExportBundle = z.infer<typeof ExportBundleSchema>;

const ITEM_STATUS_VALUES = new Set<ItemStatus>(ItemStatusSchema.options);
const ACTIVE_STATUS_VALUES: Exclude<ItemStatus, "archived">[] = ["draft", "imported", "curated"];
const ARCHIVE_RESTORE_STATUS_KEY = "__archiveRestoreStatus";

function isMetadataRecord(metadata: ContentItem["metadata"]): metadata is Record<string, unknown> {
  return Boolean(metadata) && typeof metadata === "object" && !Array.isArray(metadata);
}

function isActiveStatus(value: unknown): value is Exclude<ItemStatus, "archived"> {
  return (
    typeof value === "string" &&
    ACTIVE_STATUS_VALUES.includes(value as Exclude<ItemStatus, "archived">)
  );
}

function getArchiveRestoreStatus(item: ContentItem): Exclude<ItemStatus, "archived"> {
  if (
    isMetadataRecord(item.metadata) &&
    isActiveStatus(item.metadata[ARCHIVE_RESTORE_STATUS_KEY])
  ) {
    return item.metadata[ARCHIVE_RESTORE_STATUS_KEY];
  }

  if (item.status !== "archived") {
    return item.status;
  }

  return "curated";
}

export function itemIsArchived(item: Pick<ContentItem, "status" | "archived">): boolean {
  return item.archived || item.status === "archived";
}

export function normalizeItemLifecycle(item: ContentItem): ContentItem {
  const archived = itemIsArchived(item);
  const status: ItemStatus = archived ? "archived" : item.status;

  if (item.archived === archived && item.status === status) {
    return item;
  }

  return {
    ...item,
    archived,
    status,
  };
}

export function setItemArchived(item: ContentItem, archived: boolean): ContentItem {
  if (archived) {
    const restoreStatus = item.status === "archived" ? getArchiveRestoreStatus(item) : item.status;

    return normalizeItemLifecycle({
      ...item,
      status: "archived",
      archived: true,
      metadata: {
        ...(isMetadataRecord(item.metadata) ? item.metadata : {}),
        [ARCHIVE_RESTORE_STATUS_KEY]: restoreStatus,
      },
    });
  }

  const restoreStatus = getArchiveRestoreStatus(item);
  let metadata = item.metadata;

  if (isMetadataRecord(item.metadata) && ARCHIVE_RESTORE_STATUS_KEY in item.metadata) {
    const nextMetadata = { ...item.metadata };
    delete nextMetadata[ARCHIVE_RESTORE_STATUS_KEY];
    metadata = Object.keys(nextMetadata).length > 0 ? nextMetadata : undefined;
  }

  return normalizeItemLifecycle({
    ...item,
    status: restoreStatus,
    archived: false,
    metadata,
  });
}

export function coerceLegacyContentItem(raw: unknown): ContentItem | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const rawStatus = record.status;
  const archived = record.archived === true;
  const status: ItemStatus =
    typeof rawStatus === "string" && ITEM_STATUS_VALUES.has(rawStatus as ItemStatus)
      ? (rawStatus as ItemStatus)
      : archived
        ? "archived"
        : "draft";

  const candidate = {
    ...record,
    status,
    archived: archived || status === "archived",
  };

  const parsed = ContentItemSchema.safeParse(candidate);
  if (!parsed.success) {
    return null;
  }

  return normalizeItemLifecycle(parsed.data);
}

/**
 * Validates unknown data against the ContentItem schema.
 * Throws an error if invalid, or returns the typed object.
 */
export function validateItem(data: unknown): ContentItem {
  return ContentItemSchema.parse(data);
}

/**
 * Safely validates unknown data, returning a result object.
 */
export function safelyValidateItem(data: unknown) {
  return ContentItemSchema.safeParse(data);
}
