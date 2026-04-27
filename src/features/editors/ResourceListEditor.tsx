import { Trash2, Plus } from "lucide-react";
import type { ResourceGroup } from "@/models/item-metadata";

const inputCls =
  "w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30";

export function ResourceListEditor({
  groups,
  onChange,
}: {
  groups: ResourceGroup[];
  onChange: (groups: ResourceGroup[]) => void;
}) {
  const updateGroup = (index: number, next: ResourceGroup) => {
    const copy = groups.slice();
    copy[index] = next;
    onChange(copy);
  };

  const removeGroup = (index: number) =>
    onChange(groups.filter((_, currentIndex) => currentIndex !== index));

  return (
    <div className="space-y-4">
      {groups.map((group, groupIndex) => (
        <div
          key={groupIndex}
          className="overflow-hidden rounded-xl border border-border bg-card/60 transition-colors hover:border-primary/20"
        >
          <div className="flex items-center gap-3 bg-muted/30 px-3 py-2">
            <input
              className="flex-1 bg-transparent px-1 text-sm font-bold outline-none placeholder:text-muted-foreground/40"
              value={group.name}
              onChange={(e) => updateGroup(groupIndex, { ...group, name: e.target.value })}
              placeholder="Group title (for example: Recommended Reading)"
            />
            <button
              type="button"
              onClick={() => removeGroup(groupIndex)}
              aria-label={`Remove group ${groupIndex + 1}`}
              className="text-muted-foreground/40 transition-colors hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-2 p-4">
            {group.items.map((item, itemIndex) => (
              <div key={itemIndex} className="group/item flex items-center gap-3">
                <div className="h-1.5 w-1.5 rounded-full bg-primary/30" />
                <input
                  className={`${inputCls} h-8 border-transparent bg-transparent px-0 transition-all hover:border-border hover:bg-background`}
                  value={item}
                  onChange={(e) => {
                    const items = group.items.slice();
                    items[itemIndex] = e.target.value;
                    updateGroup(groupIndex, { ...group, items });
                  }}
                  placeholder="Reference or resource name..."
                />
                <button
                  type="button"
                  aria-label={`Remove resource ${itemIndex + 1} from ${group.name || "group"}`}
                  className="text-xs text-muted-foreground/0 transition-all group-hover/item:text-muted-foreground/40 hover:!text-destructive"
                  onClick={() =>
                    updateGroup(groupIndex, {
                      ...group,
                      items: group.items.filter((_, currentIndex) => currentIndex !== itemIndex),
                    })
                  }
                >
                  x
                </button>
              </div>
            ))}
            <button
              type="button"
              className="mt-2 text-[10px] font-bold uppercase tracking-widest text-primary/60 transition-colors hover:text-primary hover:underline"
              onClick={() => updateGroup(groupIndex, { ...group, items: [...group.items, ""] })}
            >
              + Add resource
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...groups, { name: "New group", items: [] }])}
        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-2 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" /> Add group
      </button>
    </div>
  );
}
