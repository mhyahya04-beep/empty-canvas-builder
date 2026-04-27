import type { Importer, ImportResult } from "./importer";
import type { ContentItem } from "@/models/item";
import { generateId } from "@/lib/utils/ids";
import { slugify } from "@/lib/utils/slug";
import { nowIso } from "@/lib/utils/dates";
import { fileStore } from "@/lib/files/file-store";

/**
 * PDF "registration" importer.
 * Creates a pdf_library_item that points at a binary blob stored locally.
 * The blob is keyed by `metadata.fileId` and resolved at view time by the
 * PdfLibraryItemViewer (blob URL).
 */
export const pdfImporter: Importer<File> = {
  id: "pdf",
  label: "PDF Document",
  canHandle: (file) => file.name.toLowerCase().endsWith(".pdf"),
  async import(file): Promise<ImportResult> {
    const fileId = generateId();
    await fileStore.save(fileId, file);

    const ts = nowIso();
    const title = file.name.replace(/\.pdf$/i, "");
    const item: ContentItem = {
      id: generateId(),
      type: "pdf_library_item",
      title,
      slug: slugify(title),
      subjectId: null,
      parentId: null,
      tags: ["pdf", "imported"],
      description: `Registered from ${file.name}`,
      createdAt: ts,
      updatedAt: ts,
      status: "imported",
      pinned: false,
      archived: false,
      source: { origin: "pdf", originalFilename: file.name, importedAt: ts },
      metadata: {
        fileId,
        originalFormat: "pdf",
        originalFilename: file.name,
        sizeBytes: file.size,
        category: "reference",
      },
      blocks: [],
    };
    return { items: [item], warnings: [] };
  },
};
