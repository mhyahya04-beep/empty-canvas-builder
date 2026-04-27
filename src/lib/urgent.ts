// Urgent indexer: derives urgent items from records, fields, and documents.
import { db, uid, now } from "./db/db";
import type { Field, RecordItem, Workspace, DatabaseTable, DocumentContent, UrgentItem } from "./types";

const URGENT_TAGS = new Set(["urgent", "high priority", "high"]);

function walkDoc(node: unknown, hits: { kind: string; text: string }[]) {
  if (!node || typeof node !== "object") return;
  const n = node as any;
  // mark-based urgent highlight
  if (n.type === "text" && n.text && n.marks) {
    for (const m of n.marks) {
      const cls = (m.attrs && (m.attrs.class as string)) || "";
      if (
        m.type === "urgent" ||
        (m.type === "highlight" && (m.attrs?.color === "urgent" || cls.includes("urgent"))) ||
        cls === "urgent" || cls.includes("urgent")
      ) {
        hits.push({ kind: "highlightedText", text: n.text });
      }
    }
  }
  // checklist with attr "urgent"
  if (n.type === "taskItem" && n.attrs && (n.attrs.urgent === true || (n.attrs as { class?: string }).class === "urgent")) {
    hits.push({ kind: "checklist", text: extractText(n).slice(0, 200) });
  }
  // bullet/list item with urgent class attr (custom)
  if (n.type === "listItem" && n.attrs && (n.attrs.urgent === true)) {
    hits.push({ kind: "bullet", text: extractText(n).slice(0, 200) });
  }
  if (Array.isArray(n.content)) for (const c of n.content) walkDoc(c, hits);
}
function extractText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as any;
  if (n.text) return n.text;
  if (Array.isArray(n.content)) return n.content.map(extractText).join("");
  return "";
}

function fieldValueIsUrgent(field: Field, value: unknown): boolean {
  if (!value) return false;
  if (field.type === "select" || field.type === "status") {
    const opt = field.options?.find((o) => o.id === value);
    return !!opt && URGENT_TAGS.has(opt.label.toLowerCase());
  }
  if (field.type === "multiSelect" && Array.isArray(value)) {
    return value.some((id) => {
      const opt = field.options?.find((o) => o.id === id);
      return !!opt && URGENT_TAGS.has(opt.label.toLowerCase());
    });
  }
  // checkbox named urgent
  if (field.type === "checkbox" && typeof value === "boolean") {
    const name = (field.name || "").toLowerCase();
    if (value && (name.includes("urgent") || name.includes("priority") || name.includes("important"))) return true;
  }
  return false;
}

function isFieldDeadlineSoon(field: Field, value: unknown): boolean {
  if (field.type !== "date" && field.type !== "dateTime") return false;
  if (!value) return false;
  const start = typeof value === "string" ? value : (value as any)?.start;
  if (!start) return false;
  const t = new Date(start).getTime();
  if (isNaN(t)) return false;
  const days = (t - Date.now()) / (1000 * 60 * 60 * 24);
  return days <= 7;
}

export async function buildUrgentIndex(): Promise<UrgentItem[]> {
  const [workspaces, tables, fields, records] = await Promise.all([
    db.workspaces.toArray(),
    db.tablesStore.toArray(),
    db.fields.toArray(),
    db.records.toArray(),
  ]);

  const workspaceById = new Map(workspaces.map((w) => [w.id, w]));
  const tableById = new Map(tables.map((t) => [t.id, t]));
  const fieldsByWorkspace = new Map<string, Field[]>();
  for (const f of fields) {
    const a = fieldsByWorkspace.get(f.workspaceId ?? "") ?? [];
    a.push(f);
    fieldsByWorkspace.set(f.workspaceId ?? "", a);
  }

  const out: UrgentItem[] = [];

  for (const r of records) {
    const wk = workspaceById.get(r.workspaceId ?? "");
    const tb = tableById.get(r.tableId ?? "");
    
    const baseSourceRef = { 
      recordId: r.id, 
      workspaceId: r.workspaceId, 
      tableId: r.tableId 
    };

    // per-record flag
    if (r.urgent) {
      out.push({ 
        id: `rec:${r.id}`, 
        sourceType: 'record', 
        sourceRef: baseSourceRef, 
        message: r.title || 'Urgent record', 
        priority: 2, 
        createdAt: r.updatedAt ?? now(),
        workspaceName: wk?.name,
        tableName: tb?.name
      });
    }

    // field values
    const fs = fieldsByWorkspace.get(r.workspaceId ?? "") ?? [];
    for (const f of fs) {
      const v = (r.fields ?? {})[f.id];
      if (v == null || v === "") continue;
      
      if (fieldValueIsUrgent(f, v)) {
        out.push({ 
          id: `fv:${r.id}:${f.id}`, 
          sourceType: 'property', 
          sourceRef: { ...baseSourceRef, fieldId: f.id }, 
          message: `${f.name}: Urgent`, 
          priority: 2, 
          createdAt: r.updatedAt ?? now(),
          workspaceName: wk?.name,
          tableName: tb?.name
        });
      }
      
      if (isFieldDeadlineSoon(f, v)) {
        out.push({ 
          id: `dl:${r.id}:${f.id}`, 
          sourceType: 'deadline', 
          sourceRef: { ...baseSourceRef, fieldId: f.id }, 
          message: `${f.name}: Due soon`, 
          priority: 1, 
          createdAt: r.updatedAt ?? now(),
          workspaceName: wk?.name,
          tableName: tb?.name
        });
      }
      
      // cell object marker { urgent: true }
      if (typeof v === 'object' && v !== null && (v as any).urgent === true) {
        out.push({ 
          id: `cell:${r.id}:${f.id}`, 
          sourceType: 'tableCell', 
          sourceRef: { ...baseSourceRef, fieldId: f.id }, 
          message: `${f.name}: Urgent`, 
          priority: 2, 
          createdAt: r.updatedAt ?? now(),
          workspaceName: wk?.name,
          tableName: tb?.name
        });
      }
    }

    // document hits
    if (r.documentContent) {
      const hits: { kind: string; text: string }[] = [];
      walkDoc(r.documentContent, hits);
      hits.forEach((h, i) => {
        out.push({ 
          id: `doc:${r.id}:${i}`, 
          sourceType: h.kind, 
          sourceRef: baseSourceRef, 
          message: h.text || r.title || 'Urgent note', 
          priority: 1, 
          createdAt: r.updatedAt ?? now(),
          workspaceName: wk?.name,
          tableName: tb?.name
        });
      });
    }
  }

  // derived items are returned directly for UI consumption
  return out;
}

let _urgentInterval: number | null = null;
export function startUrgentIndexer(intervalMs = 5000) {
  if (typeof window === 'undefined') return () => {};
  if (_urgentInterval) return () => { if (_urgentInterval) clearInterval(_urgentInterval); };
  // run immediately then schedule
  void buildUrgentIndex();
  _urgentInterval = window.setInterval(() => void buildUrgentIndex(), intervalMs) as any;
  return () => { if (_urgentInterval) { clearInterval(_urgentInterval); _urgentInterval = null; } };
}

export function stopUrgentIndexer() { if (_urgentInterval) { clearInterval(_urgentInterval); _urgentInterval = null; } }
