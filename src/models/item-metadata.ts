import { z } from "zod";
import type { ContentItem } from "./item";
import { isSafeWebUrl } from "@/lib/utils/url-safety";
import { validateStoredFileId } from "@/lib/files/file-id";

export const SavedLinkSchema = z.object({
  url: z.string().refine(isSafeWebUrl, "Saved link URL must use http or https"),
  title: z.string(),
  source: z.string().optional(),
  note: z.string().optional(),
});

export const ResourceGroupSchema = z.object({
  name: z.string(),
  items: z.array(z.string()),
});

export const PdfAttachmentMetadataSchema = z
  .object({
    fileId: z.string().refine((id) => validateStoredFileId(id).valid, "Invalid attachment file ID"),
    originalFilename: z.string().optional(),
    originalFormat: z.string().optional(),
    sizeBytes: z.number().optional(),
    category: z.string().optional(),
    seedAssetUrl: z.string().optional(),
  })
  .passthrough();

export type SavedLink = z.infer<typeof SavedLinkSchema>;
export type ResourceGroup = z.infer<typeof ResourceGroupSchema>;
export type PdfAttachmentMetadata = z.infer<typeof PdfAttachmentMetadataSchema>;

const MetadataObjectSchema = z.record(z.unknown());

function getMetadataObject(metadata: ContentItem["metadata"]) {
  const result = MetadataObjectSchema.safeParse(metadata);
  return result.success ? result.data : undefined;
}

export function getSavedLinks(metadata: ContentItem["metadata"]): SavedLink[] {
  const metadataObject = getMetadataObject(metadata);
  if (!metadataObject) {
    return [];
  }

  const links = metadataObject.links;
  if (!Array.isArray(links)) {
    return [];
  }

  return links.flatMap((link) => {
    const result = SavedLinkSchema.safeParse(link);
    return result.success ? [result.data] : [];
  });
}

export function getResourceGroups(metadata: ContentItem["metadata"]): ResourceGroup[] {
  const metadataObject = getMetadataObject(metadata);
  if (!metadataObject) {
    return [];
  }

  const result = z.object({ groups: z.array(ResourceGroupSchema) }).safeParse(metadataObject);
  return result.success ? result.data.groups : [];
}

export function getPdfAttachmentMetadata(
  metadata: ContentItem["metadata"],
): PdfAttachmentMetadata | null {
  const metadataObject = getMetadataObject(metadata);
  if (!metadataObject) {
    return null;
  }

  const result = PdfAttachmentMetadataSchema.safeParse(metadataObject);
  return result.success ? result.data : null;
}
