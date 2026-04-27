import mammoth from "mammoth";
import type { Importer, ImportResult } from "./importer";
import type { Block } from "@/models/block";
import type { ContentItem } from "@/models/item";
import { generateId } from "@/lib/utils/ids";
import { slugify } from "@/lib/utils/slug";
import { nowIso } from "@/lib/utils/dates";

/**
 * DOCX importer: uses mammoth to convert a .docx file into semantic HTML,
 * then walks the HTML and emits structured Blocks. This is intentionally
 * conservative: the goal is "useful, editable starting point", not a
 * pixel-perfect reproduction.
 */
export const docxImporter: Importer<File> = {
  id: "docx",
  label: "Word Document (.docx)",
  canHandle: (file) => file.name.toLowerCase().endsWith(".docx"),
  async import(file): Promise<ImportResult> {
    const arrayBuffer = await file.arrayBuffer();
    const { value: html, messages } = await mammoth.convertToHtml({ arrayBuffer });
    const blocks = htmlToBlocks(html);
    const warnings = messages.filter((m) => m.type === "warning").map((m) => m.message);

    const ts = nowIso();
    const title = file.name.replace(/\.docx$/i, "");
    const item: ContentItem = {
      id: generateId(),
      type: "note",
      title,
      slug: slugify(title),
      subjectId: null,
      parentId: null,
      tags: ["imported"],
      description: `Imported from ${file.name}`,
      createdAt: ts,
      updatedAt: ts,
      status: "imported",
      pinned: false,
      archived: false,
      source: { origin: "docx", originalFilename: file.name, importedAt: ts },
      blocks,
    };
    return { items: [item], warnings };
  },
};

function htmlToBlocks(html: string): Block[] {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return [];
  const blocks: Block[] = [];

  for (const node of Array.from(root.children)) {
    const tag = node.tagName.toLowerCase();
    const text = (node.textContent ?? "").trim();

    if (/^h[1-4]$/.test(tag) && text) {
      const level = Number(tag[1]) as 1 | 2 | 3 | 4;
      blocks.push({ id: generateId(), type: "heading", level, text });
    } else if (tag === "p" && text) {
      blocks.push({ id: generateId(), type: "paragraph", text });
    } else if (tag === "blockquote" && text) {
      blocks.push({ id: generateId(), type: "quote", text });
    } else if (tag === "ul") {
      const items = Array.from(node.querySelectorAll(":scope > li"))
        .map((li) => (li.textContent ?? "").trim())
        .filter(Boolean);
      if (items.length) blocks.push({ id: generateId(), type: "bullet_list", items });
    } else if (tag === "ol") {
      const items = Array.from(node.querySelectorAll(":scope > li"))
        .map((li) => (li.textContent ?? "").trim())
        .filter(Boolean);
      if (items.length) blocks.push({ id: generateId(), type: "numbered_list", items });
    } else if (tag === "table") {
      const headerCells = Array.from(node.querySelectorAll("thead th, tr:first-child th"));
      const headers = headerCells.map((c) => (c.textContent ?? "").trim());
      const rowEls = Array.from(node.querySelectorAll("tbody tr"));
      const rows = (
        rowEls.length
          ? rowEls
          : Array.from(node.querySelectorAll("tr")).slice(headers.length ? 1 : 0)
      ).map((tr) =>
        Array.from(tr.querySelectorAll("td,th")).map((c) => (c.textContent ?? "").trim()),
      );
      if (headers.length || rows.length) {
        blocks.push({ id: generateId(), type: "table", headers, rows });
      }
    } else if (tag === "hr") {
      blocks.push({ id: generateId(), type: "divider" });
    } else if (text) {
      blocks.push({ id: generateId(), type: "paragraph", text });
    }
  }

  return blocks;
}
