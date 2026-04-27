import type { Importer, ImportResult } from "./importer";
import type { ContentItem } from "@/models/item";
import { generateId } from "@/lib/utils/ids";
import { slugify } from "@/lib/utils/slug";
import { nowIso } from "@/lib/utils/dates";
import { safeParseWebUrl } from "@/lib/utils/url-safety";

export interface LinkImportInput {
  url: string;
  title?: string;
  note?: string;
}

function detectSource(url: string): string | undefined {
  const parsed = safeParseWebUrl(url);
  if (!parsed) return undefined;

  const host = parsed.hostname.replace(/^www\./, "");
  if (host.includes("instagram")) return "Instagram";
  if (host.includes("youtube") || host.includes("youtu.be")) return "YouTube";
  if (host.includes("twitter") || host.includes("x.com")) return "X";
  if (host.includes("github")) return "GitHub";
  return host;
}

/**
 * Link importer: turns a single URL into a fresh `link_collection` item
 * containing one saved link. Useful when the user pastes a URL and wants a
 * lightweight bookmark without creating an item by hand.
 */
export const linkImporter: Importer<LinkImportInput> = {
  id: "link",
  label: "Web Link",
  canHandle(input) {
    if (!input || typeof input.url !== "string") return false;
    return safeParseWebUrl(input.url) !== null;
  },
  async import(input): Promise<ImportResult> {
    const parsedUrl = safeParseWebUrl(input.url);
    if (!parsedUrl) {
      throw new Error("Link importer only accepts HTTP and HTTPS URLs.");
    }

    const url = parsedUrl.href;
    const ts = nowIso();
    const title = input.title?.trim() || url;
    const item: ContentItem = {
      id: generateId(),
      type: "link_collection",
      title,
      slug: slugify(title),
      subjectId: null,
      parentId: null,
      tags: ["link", "imported"],
      description: input.note,
      createdAt: ts,
      updatedAt: ts,
      status: "imported",
      pinned: false,
      archived: false,
      source: { origin: "link", url, importedAt: ts },
      metadata: {
        links: [{ url, title, source: detectSource(url), note: input.note }],
      },
      blocks: [],
    };
    return { items: [item], warnings: [] };
  },
};
