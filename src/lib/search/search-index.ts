import { itemIsArchived, type ContentItem } from "@/models/item";
import type { Block } from "@/models/block";

function blockToText(b: Block): string {
  switch (b.type) {
    case "heading":
    case "paragraph":
    case "quote":
    case "reflection":
      return b.text;
    case "bullet_list":
    case "numbered_list":
      return b.items.join(" ");
    case "table":
      return [b.headers.join(" "), ...b.rows.map((r) => r.join(" "))].join(" ");
    case "callout":
      return `${b.title ?? ""} ${b.text}`;
    case "key_value_list":
      return b.pairs.map((p) => `${p.key} ${p.value}`).join(" ");
    case "image":
      return `${b.alt ?? ""} ${b.caption ?? ""}`;
    case "link_card":
      return `${b.title} ${b.description ?? ""} ${b.url}`;
    case "pdf_reference":
      return `${b.title} ${b.notes ?? ""}`;
    case "verse":
      return `${b.reference} ${b.translation ?? ""} ${b.summary ?? ""}`;
    case "glossary_term":
      return `${b.term} ${b.definition}`;
    default:
      return "";
  }
}

const haystackCache = new WeakMap<ContentItem, string>();

export function itemHaystack(item: ContentItem): string {
  if (haystackCache.has(item)) return haystackCache.get(item)!;

  const haystack = [
    item.title,
    item.description ?? "",
    item.tags.join(" "),
    item.blocks.map(blockToText).join(" "),
  ]
    .join(" ")
    .toLowerCase();

  haystackCache.set(item, haystack);
  return haystack;
}

export interface SearchFilters {
  query?: string;
  subjectId?: string | null;
  type?: string;
  tag?: string;
  pinnedOnly?: boolean;
  includeArchived?: boolean;
}

export function filterItems(items: ContentItem[], f: SearchFilters): ContentItem[] {
  const q = f.query?.trim().toLowerCase();
  return items.filter((item) => {
    if (!f.includeArchived && itemIsArchived(item)) return false;
    if (f.pinnedOnly && !item.pinned) return false;
    if (f.subjectId !== undefined && f.subjectId !== null && item.subjectId !== f.subjectId)
      return false;
    if (f.type && item.type !== f.type) return false;
    if (f.tag && !item.tags.includes(f.tag)) return false;
    if (q && !itemHaystack(item).includes(q)) return false;
    return true;
  });
}
