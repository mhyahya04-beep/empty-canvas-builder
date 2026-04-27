import type { Block } from "@/models/block";
import type { EditorBlock } from "@/lib/types";

function textNode(text: string, marks?: Array<Record<string, unknown>>) {
  return marks && marks.length > 0 ? { type: "text", text, marks } : { type: "text", text };
}

export function paragraphBlock(text: string): EditorBlock {
  return {
    type: "paragraph",
    content: text ? [textNode(text)] : [],
  };
}

export function headingBlock(text: string, level = 2): EditorBlock {
  return {
    type: "heading",
    attrs: { level },
    content: text ? [textNode(text)] : [],
  };
}

export function bulletListBlock(items: string[]): EditorBlock {
  return {
    type: "bulletList",
    content: items.map((item) => ({
      type: "listItem",
      content: [paragraphBlock(item)],
    })),
  };
}

export function orderedListBlock(items: string[]): EditorBlock {
  return {
    type: "orderedList",
    attrs: { start: 1 },
    content: items.map((item) => ({
      type: "listItem",
      content: [paragraphBlock(item)],
    })),
  };
}

export function blockquoteBlock(text: string): EditorBlock {
  return {
    type: "blockquote",
    content: [paragraphBlock(text)],
  };
}

export function horizontalRuleBlock(): EditorBlock {
  return { type: "horizontalRule" };
}

export function imageBlock(src: string, alt?: string, title?: string): EditorBlock {
  return {
    type: "image",
    attrs: {
      src,
      alt,
      title,
    },
  };
}

export function linkParagraphBlock(label: string, href: string): EditorBlock {
  return {
    type: "paragraph",
    content: [
      textNode(label || href, [
        {
          type: "link",
          attrs: { href },
        },
      ]),
    ],
  };
}

export function tableBlock(headers: string[], rows: string[][]): EditorBlock {
  return {
    type: "table",
    content: [
      {
        type: "tableRow",
        content: headers.map((header) => ({
          type: "tableHeader",
          content: [paragraphBlock(header)],
        })),
      },
      ...rows.map((row) => ({
        type: "tableRow",
        content: row.map((cell) => ({
          type: "tableCell",
          content: [paragraphBlock(cell)],
        })),
      })),
    ],
  };
}

export function buildSectionedBlocks(
  sections: Array<{
    heading?: string;
    paragraphs?: string[];
    bullets?: string[];
    ordered?: string[];
  }>,
): EditorBlock[] {
  const blocks: EditorBlock[] = [];
  for (const section of sections) {
    if (section.heading) blocks.push(headingBlock(section.heading));
    for (const paragraph of section.paragraphs ?? []) {
      if (paragraph.trim()) blocks.push(paragraphBlock(paragraph));
    }
    if (section.bullets && section.bullets.length > 0) blocks.push(bulletListBlock(section.bullets));
    if (section.ordered && section.ordered.length > 0) blocks.push(orderedListBlock(section.ordered));
  }
  return blocks;
}

export function legacyBlocksToEditorBlocks(blocks: Block[]): EditorBlock[] {
  const result: EditorBlock[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case "heading":
        result.push(headingBlock(block.text, block.level));
        break;
      case "paragraph":
        result.push(paragraphBlock(block.text));
        break;
      case "quote":
        result.push(blockquoteBlock(block.cite ? `${block.text} (${block.cite})` : block.text));
        break;
      case "bullet_list":
        result.push(bulletListBlock(block.items));
        break;
      case "numbered_list":
        result.push(orderedListBlock(block.items));
        break;
      case "table":
        result.push(tableBlock(block.headers, block.rows));
        break;
      case "callout":
        result.push(blockquoteBlock([block.title, block.text].filter(Boolean).join(": ")));
        break;
      case "key_value_list":
        result.push(bulletListBlock(block.pairs.map((pair) => `${pair.key}: ${pair.value}`)));
        break;
      case "divider":
        result.push(horizontalRuleBlock());
        break;
      case "image":
        result.push(imageBlock(block.src, block.alt, block.caption));
        break;
      case "link_card":
        result.push(linkParagraphBlock(block.title || block.url, block.url));
        if (block.description) result.push(paragraphBlock(block.description));
        break;
      case "pdf_reference":
        result.push(paragraphBlock([block.title, block.page ? `Page ${block.page}` : undefined, block.notes].filter(Boolean).join(" | ")));
        break;
      case "verse":
        result.push(headingBlock(block.reference, 3));
        if (block.arabic) result.push(paragraphBlock(block.arabic));
        if (block.translation) result.push(paragraphBlock(block.translation));
        if (block.summary) result.push(paragraphBlock(block.summary));
        break;
      case "reflection":
        result.push(paragraphBlock(block.text));
        break;
      case "glossary_term":
        result.push(paragraphBlock(`${block.term}: ${block.definition}`));
        break;
      default:
        result.push(paragraphBlock(JSON.stringify(block)));
        break;
    }
  }

  return result;
}
