import type { ContentItem } from "@/models/item";
import { BlocksList } from "@/components/blocks/BlockRenderer";

export function NoteViewer({ item }: { item: ContentItem }) {
  return (
    <article className="prose-like">
      <BlocksList blocks={item.blocks} />
    </article>
  );
}
