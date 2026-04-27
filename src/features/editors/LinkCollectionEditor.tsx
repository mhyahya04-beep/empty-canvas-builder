import { Trash2, Plus } from "lucide-react";
import type { SavedLink } from "@/models/item-metadata";

const inputCls =
  "w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30";

export function LinkCollectionEditor({
  links,
  onChange,
}: {
  links: SavedLink[];
  onChange: (links: SavedLink[]) => void;
}) {
  const update = (index: number, next: SavedLink) => {
    const copy = links.slice();
    copy[index] = next;
    onChange(copy);
  };

  const remove = (index: number) =>
    onChange(links.filter((_, currentIndex) => currentIndex !== index));

  return (
    <div className="space-y-3">
      {links.map((link, index) => (
        <div
          key={index}
          className="group overflow-hidden rounded-xl border border-border bg-card/60 transition-colors hover:border-primary/20"
        >
          <div className="flex items-center justify-between bg-muted/30 px-3 py-1.5">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
              Link {index + 1}
            </div>
            <button
              type="button"
              onClick={() => remove(index)}
              aria-label={`Remove link ${index + 1}`}
              className="text-muted-foreground/40 transition-colors hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-3 p-4">
            <input
              className={inputCls}
              value={link.title}
              onChange={(e) => update(index, { ...link, title: e.target.value })}
              placeholder="Title"
            />
            <input
              className={inputCls}
              value={link.url}
              onChange={(e) => update(index, { ...link, url: e.target.value })}
              placeholder="https://..."
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                className={inputCls}
                value={link.source ?? ""}
                onChange={(e) => update(index, { ...link, source: e.target.value })}
                placeholder="Source (Instagram, YouTube...)"
              />
              <input
                className={inputCls}
                value={link.note ?? ""}
                onChange={(e) => update(index, { ...link, note: e.target.value })}
                placeholder="Short note"
              />
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...links, { url: "", title: "" }])}
        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-2 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" /> Add link
      </button>
    </div>
  );
}
