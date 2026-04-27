import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Eye, EyeOff, Star, X } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import type { Field, RecordItem } from "@/lib/types";
import { getRecordPropertyValue, setRecordValue } from "@/lib/storage";
import { db } from "@/lib/db/db";
import { TAG_CLASS, cn, formatDate } from "@/lib/utils";

export function CellEditor({ field, record }: { field: Field; record: RecordItem }) {
  const value = getRecordPropertyValue(record, field);
  const isSensitive = Boolean(record.isSensitive && field.sensitive);

  switch (field.type) {
    case "text":
    case "url":
    case "email":
    case "phone":
    case "person":
      return <SensitiveWrapper active={isSensitive}><TextCell field={field} record={record} value={value as string} type={field.type} /></SensitiveWrapper>;
    case "longText":
      return <SensitiveWrapper active={isSensitive}><TextCell field={field} record={record} value={value as string} type="text" /></SensitiveWrapper>;
    case "number":
      return <SensitiveWrapper active={isSensitive}><NumberCell field={field} record={record} value={value as number} /></SensitiveWrapper>;
    case "date":
    case "dateTime":
      return <SensitiveWrapper active={isSensitive}><DateCell field={field} record={record} value={value as string} /></SensitiveWrapper>;
    case "checkbox":
      return <CheckboxCell field={field} record={record} value={Boolean(value)} />;
    case "rating":
      return <RatingCell field={field} record={record} value={(value as number) ?? 0} />;
    case "select":
      return <SensitiveWrapper active={isSensitive}><SelectCell field={field} record={record} value={value as string} /></SensitiveWrapper>;
    case "multiSelect":
      return <SensitiveWrapper active={isSensitive}><MultiSelectCell field={field} record={record} value={Array.isArray(value) ? (value as string[]) : []} /></SensitiveWrapper>;
    case "relation":
      return <RelationCell field={field} record={record} value={normalizeRelationValue(value)} />;
    case "image":
    case "file":
      return <span className="px-2 text-xs italic text-muted-foreground">Open record page</span>;
    case "createdTime":
      return <span className="px-2 text-xs text-muted-foreground">{formatDate(record.createdAt)}</span>;
    case "updatedTime":
      return <span className="px-2 text-xs text-muted-foreground">{formatDate(record.updatedAt)}</span>;
    default:
      return null;
  }
}

function SensitiveWrapper({ active, children }: { active: boolean; children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!active) setRevealed(true);
    if (active) setRevealed(false);
  }, [active]);

  if (!active) return <>{children}</>;
  if (!revealed) {
    return (
      <button onClick={() => setRevealed(true)} className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
        <Eye className="h-3 w-3" /> Hidden
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <div className="min-w-0 flex-1">{children}</div>
      <button onClick={() => setRevealed(false)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="Hide sensitive value">
        <EyeOff className="h-3 w-3" />
      </button>
    </div>
  );
}

function TextCell({ field, record, value, type }: { field: Field; record: RecordItem; value?: string; type: string }) {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  const commit = () => {
    if ((draft ?? "") !== (value ?? "")) {
      void setRecordValue(record.id, field.id, draft);
    }
  };
  return (
    <input
      type={type === "url" ? "url" : "text"}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") (event.target as HTMLInputElement).blur();
      }}
      className="w-full rounded bg-transparent px-2 py-1.5 text-sm focus:bg-input focus:outline-none"
    />
  );
}

function NumberCell({ field, record, value }: { field: Field; record: RecordItem; value?: number }) {
  const [draft, setDraft] = useState(value != null ? String(value) : "");
  useEffect(() => setDraft(value != null ? String(value) : ""), [value]);
  const commit = () => {
    const next = draft === "" ? null : Number(draft);
    if (next !== value) void setRecordValue(record.id, field.id, next);
  };
  return (
    <input
      type="number"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") (event.target as HTMLInputElement).blur();
      }}
      className="w-full rounded bg-transparent px-2 py-1.5 text-sm tabular-nums focus:bg-input focus:outline-none"
    />
  );
}

function DateCell({ field, record, value }: { field: Field; record: RecordItem; value?: string }) {
  return (
    <input
      type="date"
      value={value ?? ""}
      onChange={(event) => void setRecordValue(record.id, field.id, event.target.value || null)}
      className="w-full rounded bg-transparent px-2 py-1.5 text-sm focus:bg-input focus:outline-none"
    />
  );
}

function CheckboxCell({ field, record, value }: { field: Field; record: RecordItem; value: boolean }) {
  return (
    <button
      onClick={() => void setRecordValue(record.id, field.id, !value)}
      className={cn(
        "ml-2 flex h-4 w-4 items-center justify-center rounded border transition-colors",
        value ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary",
      )}
    >
      {value && <Check className="h-3 w-3" />}
    </button>
  );
}

function RatingCell({ field, record, value }: { field: Field; record: RecordItem; value: number }) {
  return (
    <div className="flex items-center gap-0.5 px-2">
      {[1, 2, 3, 4, 5].map((rating) => (
        <button key={rating} onClick={() => void setRecordValue(record.id, field.id, rating === value ? 0 : rating)}>
          <Star className={cn("h-3.5 w-3.5", rating <= value ? "fill-primary text-primary" : "text-muted-foreground/40")} />
        </button>
      ))}
    </div>
  );
}

function SelectCell({ field, record, value }: { field: Field; record: RecordItem; value?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const option = field.options?.find((candidate) => candidate.id === value || candidate.label === value);
  return (
    <div ref={ref} className="relative px-1">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-1 rounded px-1.5 py-1 text-left hover:bg-muted">
        {option ? (
          <span className={cn("rounded-full border px-2 py-0.5 text-xs", TAG_CLASS[option.color])}>{option.label}</span>
        ) : (
          <span className="text-xs text-muted-foreground/50">-</span>
        )}
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 min-w-[160px] rounded-lg border border-border bg-popover py-1 shadow-xl">
          {value && (
            <button onClick={() => { void setRecordValue(record.id, field.id, null); setOpen(false); }} className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted">
              <X className="h-3 w-3" /> Clear
            </button>
          )}
          {field.options?.map((candidate) => (
            <button key={candidate.id} onClick={() => { void setRecordValue(record.id, field.id, candidate.id); setOpen(false); }} className="w-full px-3 py-1.5 text-left hover:bg-muted">
              <span className={cn("rounded-full border px-2 py-0.5 text-xs", TAG_CLASS[candidate.color])}>{candidate.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MultiSelectCell({ field, record, value }: { field: Field; record: RecordItem; value: string[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const toggle = (optionId: string) => {
    const next = value.includes(optionId) ? value.filter((current) => current !== optionId) : [...value, optionId];
    void setRecordValue(record.id, field.id, next);
  };

  return (
    <div ref={ref} className="relative px-1">
      <button onClick={() => setOpen(!open)} className="flex min-h-[28px] w-full flex-wrap items-center gap-1 rounded px-1.5 py-1 text-left hover:bg-muted">
        {value.length === 0 && <span className="text-xs text-muted-foreground/50">-</span>}
        {value.map((optionId) => {
          const option = field.options?.find((candidate) => candidate.id === optionId || candidate.label === optionId);
          if (!option) return null;
          return <span key={option.id} className={cn("rounded-full border px-2 py-0.5 text-xs", TAG_CLASS[option.color])}>{option.label}</span>;
        })}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-60 min-w-[180px] overflow-y-auto rounded-lg border border-border bg-popover py-1 shadow-xl">
          {field.options?.map((option) => {
            const active = value.includes(option.id) || value.includes(option.label);
            return (
              <button key={option.id} onClick={() => toggle(option.id)} className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-muted">
                <span className={cn("rounded-full border px-2 py-0.5 text-xs", TAG_CLASS[option.color])}>{option.label}</span>
                {active && <Check className="h-3 w-3 text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function normalizeRelationValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === "string");
  if (typeof value === "string" && value.trim()) return [value];
  return [];
}

function RelationCell({ field, record, value }: { field: Field; record: RecordItem; value: string[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const allRecords = useLiveQuery(() => db.records.toArray(), []) ?? [];
  const selectedRecords = value
    .map((id) => allRecords.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is RecordItem => Boolean(candidate));
  const normalizedQuery = query.trim().toLowerCase();
  const candidates = allRecords
    .filter((candidate) => candidate.id !== record.id && !candidate.archived)
    .filter((candidate) => {
      if (!normalizedQuery) return true;
      return (
        candidate.title.toLowerCase().includes(normalizedQuery) ||
        candidate.type.toLowerCase().includes(normalizedQuery) ||
        (candidate.tags ?? []).some((tag) => tag.toLowerCase().includes(normalizedQuery))
      );
    })
    .slice(0, 30);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const toggle = (recordId: string) => {
    const next = value.includes(recordId) ? value.filter((current) => current !== recordId) : [...value, recordId];
    void setRecordValue(record.id, field.id, next);
  };

  return (
    <div ref={ref} className="relative px-1">
      <button onClick={() => setOpen(!open)} className="flex min-h-[28px] w-full flex-wrap items-center gap-1 rounded px-1.5 py-1 text-left hover:bg-muted">
        {selectedRecords.length === 0 && <span className="text-xs text-muted-foreground/50">-</span>}
        {selectedRecords.slice(0, 3).map((selected) => (
          <span key={selected.id} className="max-w-[140px] truncate rounded-full border border-border bg-card px-2 py-0.5 text-xs">
            {selected.title || "Untitled"}
          </span>
        ))}
        {selectedRecords.length > 3 && <span className="text-xs text-muted-foreground">+{selectedRecords.length - 3}</span>}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-72 rounded-lg border border-border bg-popover p-2 shadow-xl">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a record to link"
            className="mb-2 w-full rounded border border-border bg-input px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="max-h-64 overflow-y-auto">
            {candidates.length === 0 ? (
              <div className="px-2 py-3 text-xs text-muted-foreground">No records found.</div>
            ) : (
              candidates.map((candidate) => {
                const active = value.includes(candidate.id);
                return (
                  <button
                    key={candidate.id}
                    onClick={() => toggle(candidate.id)}
                    className="flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left hover:bg-muted"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{candidate.title || "Untitled"}</span>
                      <span className="block truncate text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{candidate.type}</span>
                    </span>
                    {active && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
