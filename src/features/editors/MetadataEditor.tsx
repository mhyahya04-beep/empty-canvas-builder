import type { ContentItem } from "@/models/item";

const inputCls =
  "w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30";

interface Props {
  draft: ContentItem;
  onChange: (next: ContentItem) => void;
}

export function MetadataEditor({ draft, onChange }: Props) {
  const tagsValue = draft.tags.join(", ");

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Title">
        <input
          className={inputCls}
          value={draft.title}
          onChange={(e) => onChange({ ...draft, title: e.target.value })}
        />
      </Field>
      <Field label="Status">
        <select
          className={inputCls}
          value={draft.status}
          onChange={(e) => {
            const nextStatus = e.target.value as ContentItem["status"];
            onChange({
              ...draft,
              status: nextStatus,
              archived: nextStatus === "archived",
            });
          }}
        >
          <option value="draft">Draft</option>
          <option value="curated">Curated</option>
          <option value="imported">Imported</option>
          <option value="archived">Archived</option>
        </select>
      </Field>
      <Field label="Description" full>
        <textarea
          className={`${inputCls} min-h-[60px]`}
          value={draft.description ?? ""}
          onChange={(e) => onChange({ ...draft, description: e.target.value })}
        />
      </Field>
      <Field label="Tags (comma separated)" full>
        <input
          className={inputCls}
          value={tagsValue}
          onChange={(e) =>
            onChange({
              ...draft,
              tags: e.target.value
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
            })
          }
        />
      </Field>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </label>
  );
}
