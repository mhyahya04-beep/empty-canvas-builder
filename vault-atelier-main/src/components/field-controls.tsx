import { useState } from "react";
import type { Field, FieldType, TagColor } from "@/lib/types";
import { TAG_COLORS } from "@/lib/types";
import { addField, deleteField, updateField } from "@/lib/storage";
import { Confirm, useDropdown } from "./modal";
import { Plus, MoreHorizontal, Trash2, Settings2, X } from "lucide-react";
import { TAG_CLASS, cn } from "@/lib/utils";
import { uid } from "@/lib/db";

const TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Text" }, { value: "longText", label: "Long text" },
  { value: "number", label: "Number" }, { value: "date", label: "Date" },
  { value: "select", label: "Select" }, { value: "multiSelect", label: "Multi-select" },
  { value: "checkbox", label: "Checkbox" }, { value: "rating", label: "Rating" },
  { value: "url", label: "URL" }, { value: "image", label: "Image" },
  { value: "file", label: "File" },
  { value: "createdTime", label: "Created time" }, { value: "updatedTime", label: "Updated time" },
];

export function AddFieldButton({ spaceId }: { spaceId: string }) {
  const { open, setOpen, ref } = useDropdown();
  const [name, setName] = useState("");
  const [type, setType] = useState<FieldType>("text");

  const create = async () => {
    const n = name.trim() || "New Field";
    await addField(spaceId, n, type);
    setName(""); setType("text"); setOpen(false);
  };

  return (
    <div ref={ref} className="relative inline-block">
      <button onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md hover:bg-muted text-muted-foreground border border-dashed border-border">
        <Plus className="w-3 h-3" /> Add field
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-40 w-64 rounded-lg border border-border bg-popover shadow-xl p-3 space-y-2">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Field name"
            className="w-full px-2.5 py-1.5 text-sm bg-input border border-border rounded focus:outline-none focus:ring-1 focus:ring-ring" />
          <select value={type} onChange={(e) => setType(e.target.value as FieldType)}
            className="w-full px-2.5 py-1.5 text-sm bg-input border border-border rounded focus:outline-none">
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <button onClick={create} className="w-full px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90">
            Add field
          </button>
        </div>
      )}
    </div>
  );
}

export function FieldHeaderMenu({ field }: { field: Field }) {
  const { open, setOpen, ref } = useDropdown();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [name, setName] = useState(field.name);

  return (
    <>
      <div ref={ref} className="relative inline-block">
        <button onClick={() => setOpen(!open)} className="p-0.5 rounded hover:bg-muted text-muted-foreground opacity-0 group-hover/header:opacity-100">
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-1 z-40 w-44 rounded-lg border border-border bg-popover shadow-xl py-1">
            <button onClick={() => { setOpen(false); setEditing(true); setName(field.name); }}
              className="w-full px-3 py-1.5 text-sm text-left hover:bg-muted flex items-center gap-2">
              <Settings2 className="w-3.5 h-3.5" /> Edit field
            </button>
            <button onClick={() => { setOpen(false); setConfirm(true); }}
              className="w-full px-3 py-1.5 text-sm text-left hover:bg-muted flex items-center gap-2 text-destructive">
              <Trash2 className="w-3.5 h-3.5" /> Delete field
            </button>
          </div>
        )}
      </div>
      <FieldEditModal open={editing} onClose={() => setEditing(false)} field={field} initialName={name} />
      <Confirm open={confirm} onClose={() => setConfirm(false)} onConfirm={() => deleteField(field.id)}
        title={`Delete field "${field.name}"?`} description="The values stored in this column will also be removed." confirmText="Delete" destructive />
    </>
  );
}

function FieldEditModal({ open, onClose, field, initialName }: { open: boolean; onClose: () => void; field: Field; initialName: string }) {
  const [name, setName] = useState(initialName);
  const [options, setOptions] = useState(field.options ?? []);
  const isSelect = field.type === "select" || field.type === "multiSelect";

  const save = async () => {
    await updateField(field.id, { name: name.trim() || field.name, options: isSelect ? options : field.options });
    onClose();
  };
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-display font-semibold">Edit field</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-input border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          {isSelect && (
            <div>
              <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">Options</label>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {options.map((o, idx) => (
                  <div key={o.id} className="flex items-center gap-2">
                    <input value={o.label}
                      onChange={(e) => setOptions(options.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))}
                      className="flex-1 px-2 py-1 text-sm bg-input border border-border rounded" />
                    <select value={o.color}
                      onChange={(e) => setOptions(options.map((x, i) => i === idx ? { ...x, color: e.target.value as TagColor } : x))}
                      className="px-2 py-1 text-xs bg-input border border-border rounded">
                      {TAG_COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full border", TAG_CLASS[o.color])}>{o.label || "preview"}</span>
                    <button onClick={() => setOptions(options.filter((_, i) => i !== idx))}
                      className="p-1 hover:bg-muted rounded text-muted-foreground"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
              <button onClick={() => setOptions([...options, { id: uid(), label: "New option", color: "sage" }])}
                className="mt-2 text-xs text-primary hover:underline inline-flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add option
              </button>
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-border bg-muted/30 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded hover:bg-muted">Cancel</button>
          <button onClick={save} className="px-4 py-1.5 text-sm rounded bg-primary text-primary-foreground font-medium">Save</button>
        </div>
      </div>
    </div>
  );
}
