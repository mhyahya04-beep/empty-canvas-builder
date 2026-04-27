import type { ContentItem } from "@/models/item";
import { getResourceGroups } from "@/models/item-metadata";
import { BlocksList } from "@/components/blocks/BlockRenderer";

export function ResourceListViewer({ item }: { item: ContentItem }) {
  const groups = getResourceGroups(item.metadata);

  return (
    <div>
      <BlocksList blocks={item.blocks} />
      <div className="mt-6 space-y-8">
        {groups.map((g) => (
          <section key={g.name}>
            <h3 className="mb-3 font-serif text-lg font-semibold">{g.name}</h3>
            <div className="flex flex-wrap gap-2">
              {g.items.map((i) => (
                <span
                  key={i}
                  className="rounded-md border border-border bg-card px-2.5 py-1 text-sm transition hover:border-primary/40 hover:bg-accent/40"
                >
                  {i}
                </span>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
