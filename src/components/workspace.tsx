import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Copy, Eye, EyeOff, FileDown, MoreHorizontal, Plus, Star, Trash2 } from "lucide-react";
import { db } from "@/lib/db/db";
import { createRecord, deleteRecord, duplicateRecord, getRecordPropertyValue } from "@/lib/storage";
import { exportWorkspaceArchive, exportWorkspaceJSON } from "@/lib/exporters";
import { CellEditor } from "@/components/cell-editor";
import { AddFieldButton, FieldHeaderMenu } from "@/components/field-controls";
import { Confirm, useDropdown } from "@/components/modal";
import { useToast } from "@/components/toast";
import { cn, formatRelative } from "@/lib/utils";
import type { DatabaseTable, Field, RecordItem } from "@/lib/types";

export function Workspace({ spaceId }: { spaceId: string }) {
  const workspace = useLiveQuery(() => db.workspaces.get(spaceId), [spaceId]);
  const databases = useLiveQuery(() => db.tablesStore.where({ workspaceId: spaceId }).sortBy("createdAt"), [spaceId]) ?? [];
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { database?: string };
  const [query, setQuery] = useState("");
  const [showSensitive, setShowSensitive] = useState(false);
  const { toast } = useToast();
  const selectedDatabaseId = search.database ?? databases[0]?.id;

  const selectedDatabase = databases.find((database) => database.id === selectedDatabaseId) ?? databases[0];
  const fields = useLiveQuery(
    () => (selectedDatabase ? db.fields.where({ tableId: selectedDatabase.id }).sortBy("order") : Promise.resolve([])),
    [selectedDatabase?.id],
  ) ?? [];
  const records = useLiveQuery(
    () => (selectedDatabase ? db.records.where({ tableId: selectedDatabase.id }).toArray() : Promise.resolve([])),
    [selectedDatabase?.id],
  ) ?? [];
  const { open: exportOpen, setOpen: setExportOpen, ref: exportRef } = useDropdown();

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const activeRecords = records.filter((record) => !record.archived && (showSensitive || !record.isSensitive));
    if (!normalized) return activeRecords.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    return activeRecords
      .filter((record) => {
        if (record.title.toLowerCase().includes(normalized)) return true;
        if ((record.tags ?? []).some((tag) => tag.toLowerCase().includes(normalized))) return true;
        return fields.some((field) => String(getRecordPropertyValue(record, field) ?? "").toLowerCase().includes(normalized));
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }, [fields, query, records, showSensitive]);

  const hiddenSensitiveCount = records.filter((record) => !record.archived && record.isSensitive).length;

  const openRecord = (id: string) => {
    navigate({ to: "/items/$itemId", params: { itemId: id } as any });
  };

  const handleSelectDatabase = (databaseId: string) => {
    navigate({
      to: "/space/$spaceId",
      params: { spaceId } as any,
      search: { database: databaseId } as any,
    });
  };

  const handleAddRecord = async () => {
    if (!selectedDatabase) return;
    const record = await createRecord(selectedDatabase.id);
    toast({ title: "Record created", variant: "success" });
    openRecord(record.id);
  };

  const handleExport = async (format: "archive" | "json") => {
    setExportOpen(false);
    try {
      if (format === "archive") {
        await exportWorkspaceArchive(spaceId);
        toast({ title: "Workspace archive generated", variant: "success" });
      } else {
        await exportWorkspaceJSON(spaceId);
        toast({ title: "Workspace JSON exported", variant: "success" });
      }
    } catch (error) {
      toast({ title: "Export failed", description: (error as Error).message, variant: "error" });
    }
  };

  if (!workspace) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Workspace not found.</div>;
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-border bg-background px-6 py-4">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{workspace.icon ?? "📁"}</span>
              <div className="min-w-0">
                <h1 className="truncate font-display text-2xl font-semibold">{workspace.name}</h1>
                <p className="truncate text-sm text-muted-foreground">{workspace.description || `${databases.length} databases in this workspace`}</p>
              </div>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search this workspace"
              className="h-10 w-56 rounded-lg border border-border bg-card px-3 text-sm outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
            />
            <div className="relative" ref={exportRef}>
              <button onClick={() => setExportOpen(!exportOpen)} className="inline-flex h-10 items-center gap-1 rounded-lg border border-border px-3 text-sm text-muted-foreground hover:bg-muted">
                <FileDown className="h-4 w-4" /> Export
              </button>
              {exportOpen && (
                <div className="absolute right-0 top-full z-30 mt-1 w-44 rounded-lg border border-border bg-popover py-1 shadow-xl">
                  <button onClick={() => handleExport("archive")} className="w-full px-3 py-2 text-left text-sm hover:bg-muted">Readable Archive</button>
                  <button onClick={() => handleExport("json")} className="w-full px-3 py-2 text-left text-sm hover:bg-muted">Structured JSON</button>
                </div>
              )}
            </div>
            {hiddenSensitiveCount > 0 && (
              <button
                onClick={() => setShowSensitive((current) => !current)}
                className={cn(
                  "inline-flex h-10 items-center gap-1 rounded-lg border px-3 text-sm",
                  showSensitive ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {showSensitive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showSensitive ? "Hide Sensitive" : `Show Sensitive (${hiddenSensitiveCount})`}
              </button>
            )}
            <button onClick={handleAddRecord} className="inline-flex h-10 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90">
              <Plus className="h-4 w-4" /> Add Record
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {databases.map((database) => (
            <button
              key={database.id}
              onClick={() => handleSelectDatabase(database.id)}
              className={cn(
                "rounded-xl border px-4 py-2 text-left transition",
                selectedDatabase?.id === database.id ? "border-primary bg-primary/8 text-primary" : "border-border bg-card hover:border-primary/30",
              )}
            >
              <div className="text-sm font-medium">{database.name}</div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{database.recordIds?.length ?? 0} records</div>
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        {!selectedDatabase ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No databases in this workspace yet.</div>
        ) : filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-12 text-center">
            <p className="mb-2 font-display text-xl">{hiddenSensitiveCount > 0 && !showSensitive ? "Sensitive records are hidden." : "No records yet."}</p>
            <p className="mb-5 max-w-sm text-sm text-muted-foreground">
              {hiddenSensitiveCount > 0 && !showSensitive
                ? "Reveal sensitive records only when you need to work with Identity or Payment Methods data."
                : `Create a record in ${selectedDatabase.name} to start populating this workspace.`}
            </p>
            {hiddenSensitiveCount > 0 && !showSensitive && (
              <button onClick={() => setShowSensitive(true)} className="mb-3 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
                <Eye className="h-4 w-4" /> Show Sensitive Records
              </button>
            )}
            <button onClick={handleAddRecord} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              <Plus className="h-4 w-4" /> Add Record
            </button>
          </div>
        ) : (
          <RecordsTable database={selectedDatabase} fields={fields} records={filtered} onOpen={openRecord} />
        )}
      </div>
    </div>
  );
}

function RecordsTable({ database, fields, records, onOpen }: { database: DatabaseTable; fields: Field[]; records: RecordItem[]; onOpen: (id: string) => void }) {
  const visibleFields = fields.filter((field) => !field.hidden);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  return (
    <div className="min-w-full">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead className="sticky top-0 z-10 bg-background">
          <tr>
            <th className="w-[300px] border-b border-border bg-background px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Title</th>
            {visibleFields.map((field) => (
              <th key={field.id} className="group/header min-w-[170px] border-b border-border bg-background px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{field.name}</span>
                  <FieldHeaderMenu field={field} />
                </div>
              </th>
            ))}
            <th className="w-[120px] border-b border-border bg-background px-3 py-2.5 text-right">
              <AddFieldButton tableId={database.id} />
            </th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id} className="group hover:bg-muted/30">
              <td className="border-b border-border/60 px-2 py-0.5 align-middle">
                <div className="flex items-center gap-1">
                  <button onClick={() => onOpen(record.id)} className="flex-1 truncate px-2 py-1.5 text-left text-sm font-medium hover:text-primary">
                    {record.title || "Untitled"}
                  </button>
                  <RowMenu record={record} onDelete={() => setConfirmDeleteId(record.id)} />
                </div>
              </td>
              {visibleFields.map((field) => (
                <td key={field.id} className="border-b border-border/60 align-middle"><CellEditor field={field} record={record} /></td>
              ))}
              <td className="border-b border-border/60" />
            </tr>
          ))}
        </tbody>
      </table>

      <Confirm
        open={Boolean(confirmDeleteId)}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => confirmDeleteId && deleteRecord(confirmDeleteId)}
        title="Delete record?"
        description="This record page and its attachments will be permanently removed."
        confirmText="Delete"
        destructive
      />
    </div>
  );
}

function RowMenu({ record, onDelete }: { record: RecordItem; onDelete: () => void }) {
  const { open, setOpen, ref } = useDropdown();

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="rounded p-1 text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100">
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-44 rounded-lg border border-border bg-popover py-1 shadow-xl">
          <button onClick={() => { db.records.update(record.id, { favorite: !record.favorite }); setOpen(false); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted">
            <Star className={cn("h-3.5 w-3.5", record.favorite && "fill-primary text-primary")} />
            {record.favorite ? "Unfavorite" : "Favorite"}
          </button>
          <button onClick={() => { duplicateRecord(record.id); setOpen(false); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted">
            <Copy className="h-3.5 w-3.5" /> Duplicate
          </button>
          <button onClick={() => { setOpen(false); onDelete(); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-destructive hover:bg-muted">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

void formatRelative;
