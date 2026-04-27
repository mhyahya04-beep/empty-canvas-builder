import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useItemsStore } from "@/stores/items-store";
import { useUIStore } from "@/stores/ui-store";
import { ItemCard } from "@/components/items/ItemCard";
import { filterItems, type SearchFilters } from "@/lib/search/search-index";
import { useState } from "react";
import { itemIsArchived, type ItemType } from "@/models/item";

export const Route = createFileRoute("/search")({
  component: () => (
    <AppShell>
      <SearchPage />
    </AppShell>
  ),
});

const TYPE_OPTIONS: { value: ItemType | ""; label: string }[] = [
  { value: "", label: "All types" },
  { value: "note", label: "Notes" },
  { value: "pdf_library_item", label: "PDFs" },
  { value: "resource_list", label: "Resource lists" },
  { value: "link_collection", label: "Link collections" },
];

function SearchPage() {
  const items = useItemsStore((s) => s.items);
  const query = useUIStore((s) => s.searchQuery);
  const setQuery = useUIStore((s) => s.setSearchQuery);
  const [type, setType] = useState<ItemType | "">("");
  const [tag, setTag] = useState("");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [subjectId, setSubjectId] = useState("");

  const subjects = items.filter((item) => item.type === "subject" && !itemIsArchived(item));
  const allTags = Array.from(new Set(items.flatMap((item) => item.tags))).sort();

  const filters: SearchFilters = {
    query,
    type: type || undefined,
    tag: tag || undefined,
    pinnedOnly,
    includeArchived,
    subjectId: subjectId || undefined,
  };

  const results = filterItems(items, filters).filter((item) => item.type !== "subject");

  const selectCls =
    "h-9 rounded-lg border border-border bg-card/50 px-3 py-1 text-sm outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/5";

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-4xl font-bold tracking-tight">Search</h1>
        <p className="text-sm text-muted-foreground/70">
          Find notes, references, and collections across your entire vault.
        </p>
      </div>

      <div className="mt-8 space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground/40" />
          <input
            autoFocus
            aria-label="Search vault"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to find anything..."
            className="h-14 w-full rounded-2xl border border-border bg-card/50 pl-12 pr-6 font-medium shadow-sm transition-all placeholder:text-muted-foreground/30 focus:border-primary/30 focus:bg-card focus:outline-none focus:ring-8 focus:ring-primary/5"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ItemType | "")}
            className={selectCls}
          >
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className={selectCls}
          >
            <option value="">All subjects</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.title}
              </option>
            ))}
          </select>
          {allTags.length > 0 && (
            <select value={tag} onChange={(e) => setTag(e.target.value)} className={selectCls}>
              <option value="">All tags</option>
              {allTags.map((currentTag) => (
                <option key={currentTag} value={currentTag}>
                  #{currentTag}
                </option>
              ))}
            </select>
          )}
          <div className="ml-2 flex items-center gap-4">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground/60 transition-colors hover:text-foreground">
              <input
                type="checkbox"
                className="rounded-sm border-border bg-muted/40"
                checked={pinnedOnly}
                onChange={(e) => setPinnedOnly(e.target.checked)}
              />
              Pinned
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground/60 transition-colors hover:text-foreground">
              <input
                type="checkbox"
                className="rounded-sm border-border bg-muted/40"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
              />
              Archived
            </label>
          </div>
        </div>
      </div>

      <div className="mt-10 border-t border-border pt-6">
        <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">
          Showing {results.length} {results.length === 1 ? "result" : "results"}
        </div>

        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 rounded-full bg-muted/30 p-6">
              <Search className="h-8 w-8 text-muted-foreground/20" />
            </div>
            <h2 className="font-serif text-xl font-semibold">No results found</h2>
            <p className="mt-1 text-sm text-muted-foreground/70">
              Try adjusting your filters or search terms.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
