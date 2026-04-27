import { useState } from "react";
import { toast } from "sonner";
import type { ContentItem } from "@/models/item";
import { MetadataEditor } from "./MetadataEditor";
import { BlockEditor } from "./BlockEditor";
import { LinkCollectionEditor } from "./LinkCollectionEditor";
import { ResourceListEditor } from "./ResourceListEditor";
import { useItemsStore } from "@/stores/items-store";
import {
  getResourceGroups,
  getSavedLinks,
  type ResourceGroup,
  type SavedLink,
} from "@/models/item-metadata";

export function ItemEditor({ item, onClose }: { item: ContentItem; onClose: () => void }) {
  const [draft, setDraft] = useState<ContentItem>(item);
  const upsert = useItemsStore((s) => s.upsert);

  const links = getSavedLinks(draft.metadata);
  const groups = getResourceGroups(draft.metadata);

  const setLinks = (next: SavedLink[]) =>
    setDraft({ ...draft, metadata: { ...(draft.metadata ?? {}), links: next } });
  const setGroups = (next: ResourceGroup[]) =>
    setDraft({ ...draft, metadata: { ...(draft.metadata ?? {}), groups: next } });

  const onSave = async () => {
    try {
      await upsert(draft);
      toast.success("Changes saved");
      onClose();
    } catch (e) {
      toast.error("Failed to save changes");
    }
  };

  return (
    <div className="space-y-6 rounded-lg border border-border bg-card/40 p-5">
      <Section title="Metadata">
        <MetadataEditor draft={draft} onChange={setDraft} />
      </Section>

      {draft.type === "link_collection" && (
        <Section title="Saved links">
          <LinkCollectionEditor links={links} onChange={setLinks} />
        </Section>
      )}

      {draft.type === "resource_list" && (
        <Section title="Resource groups">
          <ResourceListEditor groups={groups} onChange={setGroups} />
        </Section>
      )}

      <Section title="Body blocks">
        <BlockEditor blocks={draft.blocks} onChange={(blocks) => setDraft({ ...draft, blocks })} />
      </Section>

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <button
          onClick={onClose}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}
