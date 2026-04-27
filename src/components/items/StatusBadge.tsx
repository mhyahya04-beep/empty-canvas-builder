import type { ItemStatus, ItemType } from "@/models/item";

const STATUS_TONE: Record<ItemStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  imported: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  curated: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  archived: "bg-zinc-500/10 text-zinc-500",
};

const TYPE_LABEL: Record<ItemType, string> = {
  note: "Note",
  pdf_library_item: "PDF",
  resource_list: "Resources",
  link_collection: "Links",
  folder: "Folder",
  topic: "Topic",
  subject: "Subject",
};

export function StatusBadge({ status }: { status: ItemStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${STATUS_TONE[status]}`}
    >
      {status}
    </span>
  );
}

export function TypeBadge({ type }: { type: ItemType }) {
  return (
    <span className="inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
      {TYPE_LABEL[type]}
    </span>
  );
}
