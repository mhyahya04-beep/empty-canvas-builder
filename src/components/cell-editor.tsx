import { useEffect, useRef, useState } from "react";
import type { Field, RecordItem } from "@/lib/types";
import { setRecordValue } from "@/lib/storage";
import { TAG_CLASS, cn, formatDate } from "@/lib/utils";
import { Star, Check, X, ChevronDown } from "lucide-react";

export function CellEditor({ field, record, }: { field: Field; record: RecordItem }) {
  const value = record.values?.[field.id];

  switch (field.type) {
    case "text":
    case "url":
      return <TextCell field={field} record={record} value={value as string} type={field.type} />;
    case "longText":
      return <TextCell field={field} record={record} value={value as string} type="text" />;
    case "number":
      return <NumberCell field={field} record={record} value={value as number} />;
    case "date":
      return <DateCell field={field} record={record} value={value as string} />;
    case "checkbox":
      return <CheckboxCell field={field} record={record} value={!!value} />;
    case "rating":
      return <RatingCell field={field} record={record} value={(value as number) ?? 0} />;
    case "select":
      return <SelectCell field={field} record={record} value={value as string} />;
    case "multiSelect":
      return <MultiSelectCell field={field} record={record} value={(value as string[]) ?? []} />;
    case "image":
    case "file":
      return <span className="text-xs text-muted-foreground italic px-2">— open record —</span>;
    case "createdTime":
      return <span className="px-2 text-xs text-muted-foreground">{formatDate(record.createdAt)}</span>;
    case "updatedTime":
      return <span className="px-2 text-xs text-muted-foreground">{formatDate(record.updatedAt)}</span>;
    default:
      return null;
  }
}

function TextCell({ field, record, value, type }: { field: Field; record: RecordItem; value?: string; type: string }) {
  const [v, setV] = useState(value ?? "");
  useEffect(() => setV(value ?? ""), [value]);
  const commit = () => { if ((v ?? "") !== (value ?? "")) void setRecordValue(record.id, field.id, v); };
  return (
    <input
      type={type === "url" ? "url" : "text"}
      value={v} onChange={(e) => setV(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      className="w-full bg-transparent px-2 py-1.5 text-sm focus:outline-none focus:bg-input rounded"
    />
  );
}

function NumberCell({ field, record, value }: { field: Field; record: RecordItem; value?: number }) {
  const [v, setV] = useState<string>(value != null ? String(value) : "");
  useEffect(() => setV(value != null ? String(value) : ""), [value]);
  const commit = () => { const n = v === "" ? null : Number(v); if (n !== value) void setRecordValue(record.id, field.id, n); };
  return (
    <input
      type="number" value={v} onChange={(e) => setV(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      className="w-full bg-transparent px-2 py-1.5 text-sm tabular-nums focus:outline-none focus:bg-input rounded"
    />
  );
}

function DateCell({ field, record, value }: { field: Field; record: RecordItem; value?: string }) {
  return (
    <input
      type="date" value={value ?? ""}
      onChange={(e) => void setRecordValue(record.id, field.id, e.target.value || null)}
      className="w-full bg-transparent px-2 py-1.5 text-sm focus:outline-none focus:bg-input rounded"
    />
  );
}

function CheckboxCell({ field, record, value }: { field: Field; record: RecordItem; value: boolean }) {
  return (
    <button onClick={() => void setRecordValue(record.id, field.id, !value)}
      className={cn("ml-2 w-4 h-4 rounded border flex items-center justify-center transition-colors", value ? "bg-primary border-primary text-primary-foreground" : "border-border hover:border-primary")}>
      {value && <Check className="w-3 h-3" />}
    </button>
  );
}

function RatingCell({ field, record, value }: { field: Field; record: RecordItem; value: number }) {
  return (
    <div className="flex items-center gap-0.5 px-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} onClick={() => void setRecordValue(record.id, field.id, n === value ? 0 : n)}>
          <Star className={cn("w-3.5 h-3.5", n <= value ? "fill-primary text-primary" : "text-muted-foreground/40")} />
        </button>
      ))}
    </div>
  );
}

function SelectCell({ field, record, value }: { field: Field; record: RecordItem; value?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; window.addEventListener("mousedown", fn); return () => window.removeEventListener("mousedown", fn); }, [open]);
  const opt = field.options?.find((o) => o.id === value);
  return (
    <div ref={ref} className="relative px-1">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-1 px-1.5 py-1 rounded hover:bg-muted text-left">
        {opt ? (
          <span className={cn("text-xs px-2 py-0.5 rounded-full border", TAG_CLASS[opt.color])}>{opt.label}</span>
        ) : (
          <span className="text-xs text-muted-foreground/50">—</span>
        )}
        <ChevronDown className="w-3 h-3 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 min-w-[160px] rounded-lg border border-border bg-popover shadow-xl py-1">
          {value && (
            <button onClick={() => { void setRecordValue(record.id, field.id, null); setOpen(false); }}
              className="w-full px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted text-left flex items-center gap-1.5">
              <X className="w-3 h-3" /> Clear
            </button>
          )}
          {field.options?.map((o) => (
            <button key={o.id} onClick={() => { void setRecordValue(record.id, field.id, o.id); setOpen(false); }}
              className="w-full px-3 py-1.5 hover:bg-muted text-left">
              <span className={cn("text-xs px-2 py-0.5 rounded-full border", TAG_CLASS[o.color])}>{o.label}</span>
            </button>
          ))}
          {(!field.options || field.options.length === 0) && (
            <p className="px-3 py-2 text-xs text-muted-foreground italic">No options. Add some in field settings.</p>
          )}
        </div>
      )}
    </div>
  );
}

function MultiSelectCell({ field, record, value }: { field: Field; record: RecordItem; value: string[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; window.addEventListener("mousedown", fn); return () => window.removeEventListener("mousedown", fn); }, [open]);
  const toggle = (id: string) => { const next = value.includes(id) ? value.filter((v) => v !== id) : [...value, id]; void setRecordValue(record.id, field.id, next); };
  return (
    <div ref={ref} className="relative px-1">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-1 flex-wrap px-1.5 py-1 rounded hover:bg-muted text-left min-h-[28px]">
        {value.length === 0 && <span className="text-xs text-muted-foreground/50">—</span>}
        {value.map((id) => {
          const o = field.options?.find((x) => x.id === id);
          if (!o) return null; return <span key={id} className={cn("text-xs px-2 py-0.5 rounded-full border", TAG_CLASS[o.color])}>{o.label}</span>;
        })}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 min-w-[180px] rounded-lg border border-border bg-popover shadow-xl py-1 max-h-60 overflow-y-auto">
          {field.options?.map((o) => {
            const active = value.includes(o.id);
            return (
              <button key={o.id} onClick={() => toggle(o.id)} className="w-full px-3 py-1.5 hover:bg-muted text-left flex items-center justify-between gap-2">
                <span className={cn("text-xs px-2 py-0.5 rounded-full border", TAG_CLASS[o.color])}>{o.label}</span>
                {active && <Check className="w-3 h-3 text-primary" />}
              </button>
            );
          })}
          {(!field.options || field.options.length === 0) && (
            <p className="px-3 py-2 text-xs text-muted-foreground italic">No options yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
