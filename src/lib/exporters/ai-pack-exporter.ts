import JSZip from "jszip";
import type { ContentItem } from "@/models/item";
import { SCHEMA_VERSION } from "@/models/item";
import { nowIso } from "@/lib/utils/dates";
import { saveBlob } from "@/lib/platform/file-save";

/**
 * AI Pack export: a ZIP containing
 *   - manifest.json   (schema, counts, subject map)
 *   - items/{slug}.json  (one human-readable JSON file per item)
 *   - README.md       (brief instructions for AI tools)
 *
 * The format favors readable keys + block-based bodies so AI tools can
 * regenerate notes, DOCX, PDFs, or summaries from it directly.
 */

interface AIPackItem {
  id: string;
  type: string;
  title: string;
  slug: string;
  subject: string | null;
  tags: string[];
  status: string;
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  blocks: ContentItem["blocks"];
}

function toAIPackItem(item: ContentItem, subjectTitle: string | null): AIPackItem {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    slug: item.slug,
    subject: subjectTitle,
    tags: item.tags,
    status: item.status,
    description: item.description,
    metadata: item.metadata,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    blocks: item.blocks,
  };
}

export async function buildAIPackZip(items: ContentItem[]): Promise<Blob> {
  const zip = new JSZip();
  const subjects = items.filter((i) => i.type === "subject");
  const subjectById = new Map(subjects.map((s) => [s.id, s.title]));
  const contentItems = items.filter((i) => i.type !== "subject");

  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    appName: "Scholar's Haven",
    pack: "ai-pack",
    exportedAt: nowIso(),
    counts: {
      subjects: subjects.length,
      items: contentItems.length,
    },
    subjects: subjects.map((s) => ({ id: s.id, title: s.title, slug: s.slug })),
    items: contentItems.map((i) => ({
      id: i.id,
      type: i.type,
      title: i.title,
      slug: i.slug,
      subject: i.subjectId ? (subjectById.get(i.subjectId) ?? null) : null,
      file: `items/${i.slug}-${i.id.slice(0, 6)}.json`,
    })),
  };

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file(
    "README.md",
    [
      "# Scholar's Haven - AI Pack",
      "",
      "This bundle contains structured study content from a local Scholar's Haven vault.",
      "",
      "- `manifest.json` lists every item with its subject and file path.",
      "- `items/*.json` is one item per file. Each has a `blocks` array using a",
      "  small block schema (heading, paragraph, bullet_list, verse, callout,",
      "  link_card, key_value_list, etc.).",
      "",
      "You can use this pack to regenerate formatted notes, DOCX/PDF study sheets,",
      "summaries, or flashcards.",
      "",
    ].join("\n"),
  );

  const itemsFolder = zip.folder("items");
  if (!itemsFolder) throw new Error("Could not create items folder.");

  for (const item of contentItems) {
    const subjectTitle = item.subjectId ? (subjectById.get(item.subjectId) ?? null) : null;
    const filename = `${item.slug}-${item.id.slice(0, 6)}.json`;
    itemsFolder.file(filename, JSON.stringify(toAIPackItem(item, subjectTitle), null, 2));
  }

  return zip.generateAsync({ type: "blob" });
}

export async function downloadAIPack(
  items: ContentItem[],
  filename = "scholar-ai-pack.zip",
): Promise<boolean> {
  const blob = await buildAIPackZip(items);
  return saveBlob(blob, {
    suggestedName: filename,
    filters: [{ name: "ZIP archive", extensions: ["zip"] }],
  });
}
