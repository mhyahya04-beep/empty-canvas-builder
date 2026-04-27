import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { db } from "@/lib/db/db";
import {
  createRecord, deleteRecord, duplicateRecord, getDefaultTableForWorkspace
} from "@/lib/storage";
import { exportWorkspaceArchive, exportWorkspaceJSON } from "@/lib/exporters";

import { CellEditor } from "@/components/cell-editor";
import { AddFieldButton, FieldHeaderMenu } from "@/components/field-controls";
import { RecordDrawer } from "@/components/record-drawer";
import { useToast } from "@/components/toast";
import { Confirm, useDropdown } from "@/components/modal";
import { ChevronDown, Plus, Search, Star, Copy, Trash2, MoreHorizontal, FileDown, Table as TableIcon, LayoutGrid, List as ListIcon, Columns, Calendar, ArrowDown, ArrowUp, Filter as FilterIcon } from "lucide-react";
import { TAG_CLASS, cn, formatDate, formatRelative } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import type { Field, RecordItem } from "@/lib/types";

type ViewType = "table" | "list" | "gallery" | "board" | "calendar";

export function Workspace({ spaceId }: { spaceId: string }) {
  // Mapping 'space' to 'workspace' for the merged model
  const space = useLiveQuery(() => db.workspaces.get(spaceId), [spaceId]);
  
  // We'll target the default table for now to maintain compatibility with the Vault UI
  const defaultTable = useLiveQuery(() => getDefaultTableForWorkspace(spaceId), [spaceId]);
  const tableId = defaultTable?.id;

  const fields = useLiveQuery(
    () => tableId ? db.fields.where({ tableId }).sortBy("order") : Promise.resolve([]),
    [tableId]
  ) ?? [];
  
  const records = useLiveQuery(
    () => tableId ? db.records.where({ tableId }).toArray() : Promise.resolve([]),
    [tableId]
  ) ?? [];

  const search = useSearch({ strict: false }) as { record?: string };
  const navigate = useNavigate();
  const { toast } = useToast();

  const [viewType, setViewType] = useState<ViewType>("table");
  const [query, setQuery] = useState("");
  const [sortFieldId, setSortFieldId] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filterFieldId, setFilterFieldId] = useState<string | null>(null);
  const [filterValue, setFilterValue] = useState("");
  const [boardField, setBoardField] = useState<string | null>(null);
  const { open: exportOpen, setOpen: setExportOpen, ref: exportRef } = useDropdown();


  const openRecord = (id: string | null) => {
    if (!id) return;
    navigate({
      to: "/items/$itemId",
      params: { itemId: id },
    } as any);
  };

  const filtered = useMemo(() => {
    let rs = records.filter((r) => !r.archived);
    const q = query.trim().toLowerCase();
    if (q) {
      rs = rs.filter((r) => {
        if (r.title.toLowerCase().includes(q)) return true;
        return Object.values(r.fields ?? {}).some((v) => String(v ?? "").toLowerCase().includes(q));
      });
    }
    if (filterFieldId && filterValue) {
      rs = rs.filter((r) => {
        const v = r.fields?.[filterFieldId];
        if (Array.isArray(v)) return v.includes(filterValue);
        return v === filterValue;
      });
    }
    if (sortFieldId) {
      const dir = sortDir === "asc" ? 1 : -1;
      rs = [...rs].sort((a, b) => {
        const av = a.fields?.[sortFieldId];
        const bv = b.fields?.[sortFieldId];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
        return String(av).localeCompare(String(bv)) * dir;
      });
    } else {
      rs = [...rs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    return rs;
  }, [records, query, sortFieldId, sortDir, filterFieldId, filterValue]);

  const handleAddRecord = async () => {
    if (!tableId) return;
    const r = await createRecord(tableId);
    toast({ title: "Record created", variant: "success" });
    openRecord(r.id);
  };

  const handleExport = async (format: 'archive' | 'json') => {
    if (!spaceId) return;
    setExportOpen(false);
    try {
      if (format === 'archive') {
        await exportWorkspaceArchive(spaceId);
        toast({ title: "Workspace archive generated", variant: "success" });
      } else {
        await exportWorkspaceJSON(spaceId);
        toast({ title: "Workspace JSON exported", variant: "success" });
      }
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message, variant: "error" });
    }
  };


  if (!space) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">Space not found.</div>;
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <header className="border-b border-border bg-background px-6 py-3 flex items-center gap-3 shrink-0 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xl">{(space as any).icon ?? "📁"}</span>
          <div className="min-w-0">
            <h1 className="font-display text-lg font-semibold truncate">{space.name}</h1>
            <p className="text-[11px] text-muted-foreground truncate">{records.length} records · saved locally</p>
          </div>
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search this space…"
            className="pl-8 pr-3 py-1.5 text-sm bg-input border border-border rounded-md w-56 focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <ViewSwitcher value={viewType} onChange={setViewType} />
        <SortMenu fields={fields} sortFieldId={sortFieldId} sortDir={sortDir}
          setSort={(id, dir) => { setSortFieldId(id); setSortDir(dir); }} />
        <FilterMenu fields={fields} filterFieldId={filterFieldId} filterValue={filterValue}
          setFilter={(fid, val) => { setFilterFieldId(fid); setFilterValue(val); }} />
        <div className="relative" ref={exportRef}>
          <button onClick={() => setExportOpen(!exportOpen)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md hover:bg-muted text-muted-foreground border border-border" title="Export Workspace">
            <FileDown className="w-3.5 h-3.5" /> Export
          </button>
          {exportOpen && (
            <div className="absolute right-0 top-full mt-1 z-30 w-48 rounded-lg border border-border bg-popover shadow-xl py-1">
              <button onClick={() => handleExport('archive')} className="w-full px-3 py-1.5 text-sm hover:bg-muted text-left flex flex-col">
                <span>Readable Archive</span>
                <span className="text-[10px] text-muted-foreground">ZIP of PDFs, DOCX, & JSON</span>
              </button>
              <button onClick={() => handleExport('json')} className="w-full px-3 py-1.5 text-sm hover:bg-muted text-left flex flex-col border-t border-border mt-1 pt-2">
                <span>Structured JSON</span>
                <span className="text-[10px] text-muted-foreground">Single data file</span>
              </button>
            </div>
          )}
        </div>

        <button onClick={handleAddRecord} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90">
          <Plus className="w-3.5 h-3.5" /> Add Record
        </button>
      </header>

      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <EmptyState query={query} onAdd={handleAddRecord} />
        ) : viewType === "table" ? (
          <TableView fields={fields} records={filtered} spaceId={spaceId} onOpen={openRecord} tableId={tableId} />
        ) : viewType === "list" ? (
          <ListView fields={fields} records={filtered} onOpen={openRecord} />
        ) : viewType === "gallery" ? (
          <GalleryView fields={fields} records={filtered} onOpen={openRecord} />
        ) : viewType === "board" ? (
          <BoardView fields={fields} records={filtered} boardField={boardField} setBoardField={setBoardField} onOpen={openRecord} />
        ) : (
          <CalendarView fields={fields} records={filtered} onOpen={openRecord} />
        )}
      </div>
    </div>
  );
}

function ViewSwitcher({ value, onChange }: { value: ViewType; onChange: (v: ViewType) => void }) {
  const items: { v: ViewType; icon: React.ReactNode; label: string }[] = [
    { v: "table", icon: <TableIcon className="w-3.5 h-3.5" />, label: "Table" },
    { v: "list", icon: <ListIcon className="w-3.5 h-3.5" />, label: "List" },
    { v: "gallery", icon: <LayoutGrid className="w-3.5 h-3.5" />, label: "Gallery" },
    { v: "board", icon: <Columns className="w-3.5 h-3.5" />, label: "Board" },
    { v: "calendar", icon: <Calendar className="w-3.5 h-3.5" />, label: "Calendar" },
  ];
  return (
    <div className="flex items-center bg-muted/50 border border-border rounded-md p-0.5">
      {items.map((it) => (
        <button key={it.v} onClick={() => onChange(it.v)} title={it.label}
          className={cn("p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors",
            value === it.v && "bg-card text-foreground shadow-sm")}>{it.icon}</button>
      ))}
    </div>
  );
}

function SortMenu({ fields, sortFieldId, sortDir, setSort }: {
  fields: Field[]; sortFieldId: string | null; sortDir: "asc" | "desc";
  setSort: (id: string | null, dir: "asc" | "desc") => void;
}) {
  const { open, setOpen, ref } = useDropdown();
  const active = fields.find((f) => f.id === sortFieldId);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className={cn("inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border border-border hover:bg-muted",
          active ? "text-foreground" : "text-muted-foreground")}>
        {sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
        {active ? `Sort: ${active.name}` : "Sort"}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-56 rounded-lg border border-border bg-popover shadow-xl py-1 max-h-72 overflow-y-auto">
          <button onClick={() => { setSort(null, "asc"); setOpen(false); }} className="w-full px-3 py-1.5 text-sm hover:bg-muted text-left text-muted-foreground">No sort</button>
          {fields.map((f) => (
            <div key={f.id} className="flex items-center">
              <button onClick={() => { setSort(f.id, "asc"); setOpen(false); }} className="flex-1 px-3 py-1.5 text-sm hover:bg-muted text-left">{f.name} ↑</button>
              <button onClick={() => { setSort(f.id, "desc"); setOpen(false); }} className="px-3 py-1.5 text-sm hover:bg-muted">↓</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterMenu({ fields, filterFieldId, filterValue, setFilter }: {
  fields: Field[]; filterFieldId: string | null; filterValue: string;
  setFilter: (fid: string | null, val: string) => void;
}) {
  const { open, setOpen, ref } = useDropdown();
  const selectFields = fields.filter((f) => f.type === "select" || f.type === "multiSelect");
  const active = fields.find((f) => f.id === filterFieldId);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className={cn("inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border border-border hover:bg-muted",
          active ? "text-foreground border-primary/40 bg-primary/5" : "text-muted-foreground")}>
        <FilterIcon className="w-3 h-3" /> {active ? `Filter: ${active.name}` : "Filter"}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-64 rounded-lg border border-border bg-popover shadow-xl p-3 space-y-2">
          <select value={filterFieldId ?? ""} onChange={(e) => setFilter(e.target.value || null, "")}
            className="w-full px-2 py-1.5 text-sm bg-input border border-border rounded">
            <option value="">No filter</option>
            {selectFields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          {filterFieldId && (
            <select value={filterValue} onChange={(e) => setFilter(filterFieldId, e.target.value)}
              className="w-full px-2 py-1.5 text-sm bg-input border border-border rounded">
              <option value="">Any value</option>
              {fields.find((f) => f.id === filterFieldId)?.options?.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          )}
          {selectFields.length === 0 && <p className="text-xs text-muted-foreground italic">Add a select field to filter.</p>}
        </div>
      )}
    </div>
  );
}

function EmptyState({ query, onAdd }: { query: string; onAdd: () => void }) {
  if (query) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-12">
        <p className="font-display text-lg mb-1">Nothing found.</p>
        <p className="text-sm text-muted-foreground">The archive checked every drawer.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-12">
      <p className="font-display text-xl mb-2">No records yet.</p>
      <p className="text-sm text-muted-foreground mb-5 max-w-sm">Add your first item, note, memory, recipe, idea, or obsession.</p>
      <button onClick={onAdd} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
        <Plus className="w-4 h-4" /> Add Record
      </button>
    </div>
  );
}

/* ---------- TABLE ---------- */
function TableView({ fields, records, spaceId, onOpen, tableId }: { fields: Field[]; records: RecordItem[]; spaceId: string; onOpen: (id: string) => void; tableId?: string }) {
  const visible = fields.filter((f) => !f.hidden);
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null);
  return (
    <div className="min-w-full">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead className="sticky top-0 z-10 bg-background">
          <tr>
            <th className="text-left font-medium text-xs uppercase tracking-wider text-muted-foreground px-3 py-2.5 border-b border-border bg-background w-[280px]">Title</th>
            {visible.map((f) => (
              <th key={f.id} className="group/header text-left font-medium text-xs uppercase tracking-wider text-muted-foreground px-3 py-2.5 border-b border-border bg-background min-w-[160px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{f.name}</span>
                  <FieldHeaderMenu field={f} />
                </div>
              </th>
            ))}
            <th className="px-3 py-2.5 border-b border-border bg-background w-[120px]">
              {tableId && <AddFieldButton tableId={tableId} />}
            </th>
          </tr>
        </thead>
        <tbody>
          <AnimatePresence initial={false}>
            {records.map((r) => (
              <motion.tr
                key={r.id}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="group hover:bg-muted/40"
              >
                <td className="border-b border-border/60 px-2 py-0.5 align-middle">
                  <div className="flex items-center gap-1">
                    <button onClick={() => onOpen(r.id)} className="flex-1 text-left px-2 py-1.5 text-sm font-medium hover:text-primary truncate">
                      {r.title || "Untitled"}
                    </button>
                    <RowMenu record={r} onDelete={() => setConfirmDelId(r.id)} />
                  </div>
                </td>
                {visible.map((f) => (
                  <td key={f.id} className="border-b border-border/60 align-middle"><CellEditor field={f} record={r} /></td>
                ))}
                <td className="border-b border-border/60" />
              </motion.tr>
            ))}
          </AnimatePresence>
        </tbody>
      </table>
      <Confirm open={!!confirmDelId} onClose={() => setConfirmDelId(null)}
        onConfirm={() => confirmDelId && deleteRecord(confirmDelId)}
        title="Delete record?" description="This record and its notes will be permanently removed." confirmText="Delete" destructive />
    </div>
  );
}

function RowMenu({ record, onDelete }: { record: RecordItem; onDelete: () => void }) {
  const { open, setOpen, ref } = useDropdown();
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="p-1 rounded hover:bg-muted text-muted-foreground opacity-0 group-hover:opacity-100">
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 w-44 rounded-lg border border-border bg-popover shadow-xl py-1">
          <button onClick={() => { db.records.update(record.id, { favorite: !record.favorite }); setOpen(false); }}
            className="w-full px-3 py-1.5 text-sm hover:bg-muted text-left flex items-center gap-2">
            <Star className={cn("w-3.5 h-3.5", record.favorite && "fill-primary text-primary")} /> {record.favorite ? "Unfavorite" : "Favorite"}
          </button>
          <button onClick={() => { duplicateRecord(record.id); setOpen(false); }}
            className="w-full px-3 py-1.5 text-sm hover:bg-muted text-left flex items-center gap-2">
            <Copy className="w-3.5 h-3.5" /> Duplicate
          </button>
          <button onClick={() => { setOpen(false); onDelete(); }}
            className="w-full px-3 py-1.5 text-sm hover:bg-muted text-left flex items-center gap-2 text-destructive">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- LIST ---------- */
function ListView({ fields, records, onOpen }: { fields: Field[]; records: RecordItem[]; onOpen: (id: string) => void }) {
  const previewField = fields.find((f) => f.type === "select" || f.type === "multiSelect");
  return (
    <div className="max-w-3xl mx-auto px-6 py-6 space-y-2">
      {records.map((r) => {
        const tag = previewField && r.fields?.[previewField.id];
        let chip: React.ReactNode = null;
        if (previewField && tag) {
          if (Array.isArray(tag)) {
            chip = tag.slice(0, 2).map((id) => {
              const o = previewField.options?.find((x) => x.id === id);
              return o ? <span key={id} className={cn("text-[10px] px-2 py-0.5 rounded-full border", TAG_CLASS[o.color])}>{o.label}</span> : null;
            });
          } else {
            const o = previewField.options?.find((x) => x.id === tag);
            chip = o ? <span className={cn("text-[10px] px-2 py-0.5 rounded-full border", TAG_CLASS[o.color])}>{o.label}</span> : null;
          }
        }
        return (
          <button key={r.id} onClick={() => onOpen(r.id)}
            className="w-full text-left flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-card/80 transition-colors">
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{r.title || "Untitled"}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{formatRelative(r.updatedAt)}</div>
            </div>
            <div className="flex gap-1.5 shrink-0">{chip}</div>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- GALLERY ---------- */
function GalleryView({ fields, records, onOpen }: { fields: Field[]; records: RecordItem[]; onOpen: (id: string) => void }) {
  const tagField = fields.find((f) => f.type === "select" || f.type === "multiSelect");
  return (
    <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {records.map((r) => (
        <button key={r.id} onClick={() => onOpen(r.id)}
          className="text-left p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:-translate-y-0.5 transition-all hover:shadow-md aspect-[4/3] flex flex-col">
          <div className="font-display text-base font-semibold mb-2 line-clamp-2">{r.title || "Untitled"}</div>
          <div className="flex flex-wrap gap-1 mt-auto">
            {tagField && (() => {
              const v = r.fields?.[tagField.id];
              const ids = Array.isArray(v) ? v : v ? [v as string] : [];
              return ids.slice(0, 3).map((id) => {
                const o = tagField.options?.find((x) => x.id === id);
                return o ? <span key={id} className={cn("text-[10px] px-2 py-0.5 rounded-full border", TAG_CLASS[o.color])}>{o.label}</span> : null;
              });
            })()}
          </div>
          <div className="text-xs text-muted-foreground mt-2">{formatRelative(r.updatedAt)}</div>
        </button>
      ))}
    </div>
  );
}

/* ---------- BOARD ---------- */
function BoardView({ fields, records, boardField, setBoardField, onOpen }: {
  fields: Field[]; records: RecordItem[];
  boardField: string | null; setBoardField: (id: string | null) => void;
  onOpen: (id: string) => void;
}) {
  const selectFields = fields.filter((f) => f.type === "select");
  const fieldId = boardField ?? selectFields[0]?.id;
  const field = fields.find((f) => f.id === fieldId);

  if (!field) {
    return <div className="p-12 text-center text-sm text-muted-foreground">Add a single-select field to use the board view.</div>;
  }

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Group by:</span>
        <select value={field.id} onChange={(e) => setBoardField(e.target.value)}
          className="px-2 py-1 bg-input border border-border rounded">
          {selectFields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {(field.options ?? []).map((o) => {
          const items = records.filter((r) => r.fields?.[field.id] === o.id);
          return (
            <div key={o.id} className="w-72 shrink-0 bg-muted/40 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className={cn("text-xs px-2 py-0.5 rounded-full border", TAG_CLASS[o.color])}>{o.label}</span>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((r) => (
                  <button key={r.id} onClick={() => onOpen(r.id)}
                    className="w-full text-left p-3 rounded-lg bg-card border border-border hover:border-primary/40">
                    <div className="text-sm font-medium truncate">{r.title || "Untitled"}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">{formatRelative(r.updatedAt)}</div>
                  </button>
                ))}
                {items.length === 0 && <p className="text-xs text-muted-foreground italic px-1">Empty</p>}
              </div>
            </div>
          );
        })}
        {(() => {
          const items = records.filter((r) => !r.fields?.[field.id]);
          if (items.length === 0) return null;
          return (
            <div className="w-72 shrink-0 bg-muted/30 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground italic">No value</span>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((r) => (
                  <button key={r.id} onClick={() => onOpen(r.id)}
                    className="w-full text-left p-3 rounded-lg bg-card border border-border hover:border-primary/40">
                    <div className="text-sm font-medium truncate">{r.title || "Untitled"}</div>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

/* ---------- CALENDAR ---------- */
function CalendarView({ fields, records, onOpen }: { fields: Field[]; records: RecordItem[]; onOpen: (id: string) => void }) {
  const dateField = fields.find((f) => f.type === "date");
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  if (!dateField) {
    return <div className="p-12 text-center text-sm text-muted-foreground">Add a date field to use the calendar view.</div>;
  }
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: { date: Date | null }[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push({ date: null });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(year, month, d) });

  const byDay: Record<string, RecordItem[]> = {};
  for (const r of records) {
    const d = r.fields?.[dateField.id] as string | undefined;
    if (!d) continue;
    (byDay[d] ??= []).push(r);
  }
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl">{cursor.toLocaleString(undefined, { month: "long", year: "numeric" })}</h2>
        <div className="flex gap-1">
          <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="px-2 py-1 text-sm rounded hover:bg-muted">←</button>
          <button onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); }} className="px-3 py-1 text-sm rounded hover:bg-muted">Today</button>
          <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="px-2 py-1 text-sm rounded hover:bg-muted">→</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs text-muted-foreground mb-1">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => <div key={d} className="px-2 py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          const items = c.date ? byDay[fmt(c.date)] ?? [] : [];
          return (
            <div key={i} className={cn("min-h-[88px] p-1.5 rounded-lg border", c.date ? "border-border bg-card" : "border-transparent")}>
              {c.date && <div className="text-xs text-muted-foreground mb-1">{c.date.getDate()}</div>}
              <div className="space-y-1">
                {items.slice(0, 3).map((r) => (
                  <button key={r.id} onClick={() => onOpen(r.id)}
                    className="w-full text-left text-[11px] truncate px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20">
                    {r.title || "Untitled"}
                  </button>
                ))}
                {items.length > 3 && <div className="text-[10px] text-muted-foreground px-1.5">+{items.length - 3}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// silence unused warnings from imports kept for potential future use
void ChevronDown; void formatDate;
