import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Eye, EyeOff, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { db } from "@/lib/db/db";
import type { RecordItem } from "@/lib/types";

export const Route = (createFileRoute as any)("/search")({
  component: SearchRoute,
});

function SearchRoute() {
  return (
    <AppShell>
      <SearchPage />
    </AppShell>
  );
}

function SearchPage() {
  const records = useLiveQuery(() => db.records.toArray(), []) ?? [];
  const [query, setQuery] = useState("");
  const [showSensitive, setShowSensitive] = useState(false);
  const normalizedQuery = query.trim().toLowerCase();
  const searchableRecords = useMemo(
    () => records.filter((record) => !record.archived && (showSensitive || !record.isSensitive)),
    [records, showSensitive],
  );
  const hiddenSensitiveCount = records.filter((record) => !record.archived && record.isSensitive).length;

  const results = useMemo(() => {
    if (!normalizedQuery) return searchableRecords.slice(0, 50);
    return searchableRecords.filter((record) => recordMatchesQuery(record, normalizedQuery)).slice(0, 100);
  }, [searchableRecords, normalizedQuery]);

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-1 flex-col overflow-y-auto px-8 py-10">
      <div className="mb-8">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Global Search</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Search across migrated vault records, recipes, notes, and library pages.
        </p>
      </div>

      <div className="mb-8 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search titles, tags, and properties"
            className="h-12 w-full rounded-xl border border-border bg-card pl-11 pr-4 text-sm outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
          />
        </div>
        {hiddenSensitiveCount > 0 && (
          <button
            onClick={() => setShowSensitive((current) => !current)}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm text-muted-foreground transition hover:bg-muted"
          >
            {showSensitive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showSensitive ? "Hide Sensitive" : `Show Sensitive (${hiddenSensitiveCount})`}
          </button>
        )}
      </div>

      <div className="mb-4 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {results.length} result{results.length === 1 ? "" : "s"}
      </div>

      <div className="space-y-3">
        {results.map((record) => (
          <Link
            key={record.id}
            to="/items/$itemId"
            params={{ itemId: record.id } as any}
            className="block rounded-2xl border border-border bg-card p-4 transition hover:border-primary/30 hover:bg-card/80"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="truncate font-medium">{record.title || "Untitled"}</div>
                <div className="mt-1 truncate text-xs text-muted-foreground">
                  {[record.type, ...(record.tags ?? [])].filter(Boolean).join(" • ")}
                </div>
              </div>
              <div className="shrink-0 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {record.updatedAt?.slice(0, 10)}
              </div>
            </div>
          </Link>
        ))}
        {results.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            No records match this search.
          </div>
        )}
      </div>
    </div>
  );
}

function recordMatchesQuery(record: RecordItem, query: string): boolean {
  if (record.title.toLowerCase().includes(query)) return true;
  if ((record.tags ?? []).some((tag) => tag.toLowerCase().includes(query))) return true;
  for (const value of Object.values(record.properties ?? {})) {
    if (String(value ?? "").toLowerCase().includes(query)) return true;
  }
  return false;
}
