// Urgent indexer: derives urgent items from records, fields, and documents.
import { db, now } from "./db/db";
import type { DatabaseTable, Field, RecordItem, UrgentItem } from "./types";
import { getRecordFieldValue } from "@/lib/migration/shape";

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
    const opt = field.options?.find((o) => o.id === value || o.label === value);
    const label = opt?.label ?? (typeof value === "string" ? value : "");
    return URGENT_TAGS.has(label.toLowerCase());
  }
  if (field.type === "multiSelect" && Array.isArray(value)) {
    return value.some((id) => {
      const opt = field.options?.find((o) => o.id === id || o.label === id);
      const label = opt?.label ?? id;
      return URGENT_TAGS.has(label.toLowerCase());
    });
  }
  // checkbox named urgent
  if (field.type === "checkbox" && typeof value === "boolean") {
    const name = (field.name || "").toLowerCase();
    if (value && (name.includes("urgent") || name.includes("priority") || name.includes("important"))) return true;
  }
  return false;
}

function getDeadlineUrgency(field: Field, value: unknown, table?: DatabaseTable): { priority: number; message: string } | null {
  if (field.type !== "date" && field.type !== "dateTime") return null;
  if (!value) return null;
  const start = typeof value === "string" ? value : (value as any)?.start;
  if (!start) return null;
  const t = new Date(start).getTime();
  if (isNaN(t)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(t);
  target.setHours(0, 0, 0, 0);
  const days = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const key = `${field.key} ${field.name} ${table?.type ?? ""}`.toLowerCase();
  const longHorizon = /expiry|expire|warranty|renewal|subscription|license|passport|visa/.test(key);
  const eventHorizon = /deadline|due|appointment|event|date|scheduled|planned|end/.test(key);

  if (days < 0) {
    return { priority: 3, message: `${field.name}: overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}` };
  }
  if (days === 0) {
    return { priority: 3, message: `${field.name}: due today` };
  }
  if (days <= 7) {
    return { priority: 3, message: `${field.name}: due in ${days} day${days === 1 ? "" : "s"}` };
  }
  if (longHorizon && days <= 90) {
    return { priority: days <= 30 ? 2 : 1, message: `${field.name}: due in ${days} days` };
  }
  if (eventHorizon && days <= 14) {
    return { priority: 1, message: `${field.name}: due in ${days} days` };
  }
  return null;
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
  const fieldsByTable = new Map<string, Field[]>();
  for (const f of fields) {
    const a = fieldsByTable.get(f.tableId ?? "") ?? [];
    a.push(f);
    fieldsByTable.set(f.tableId ?? "", a);
  }

  const out: UrgentItem[] = [];

  for (const r of records) {
    if (r.archived) continue;
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
        tableName: tb?.name,
        recordTitle: r.title,
        isSensitive: r.isSensitive,
      });
    }

    // field values
    const fs = fieldsByTable.get(r.tableId ?? "") ?? [];
    for (const f of fs) {
      const v = getRecordFieldValue(r, f);
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
          tableName: tb?.name,
          recordTitle: r.title,
          isSensitive: r.isSensitive,
        });
      }
      
      const deadline = getDeadlineUrgency(f, v, tb);
      if (deadline) {
        out.push({ 
          id: `dl:${r.id}:${f.id}`, 
          sourceType: 'deadline', 
          sourceRef: { ...baseSourceRef, fieldId: f.id }, 
          message: deadline.message, 
          priority: deadline.priority, 
          createdAt: r.updatedAt ?? now(),
          workspaceName: wk?.name,
          tableName: tb?.name,
          recordTitle: r.title,
          isSensitive: r.isSensitive,
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
          tableName: tb?.name,
          recordTitle: r.title,
          isSensitive: r.isSensitive,
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
          tableName: tb?.name,
          recordTitle: r.title,
          isSensitive: r.isSensitive,
        });
      });
    }
  }

  return out.sort((left, right) => right.priority - left.priority || right.createdAt.localeCompare(left.createdAt));
}

export async function refreshUrgentIndex(): Promise<UrgentItem[]> {
  const items = await buildUrgentIndex();
  await db.transaction("rw", db.urgentItems, async () => {
    await db.urgentItems.clear();
    if (items.length > 0) {
      await db.urgentItems.bulkPut(items);
    }
  });
  return items;
}

let _urgentInterval: number | null = null;
export function startUrgentIndexer(intervalMs = 5000) {
  if (typeof window === 'undefined') return () => {};
  if (_urgentInterval) return () => { if (_urgentInterval) clearInterval(_urgentInterval); };
  // run immediately then schedule
  void refreshUrgentIndex();
  _urgentInterval = window.setInterval(() => void refreshUrgentIndex(), intervalMs) as any;
  return () => { if (_urgentInterval) { clearInterval(_urgentInterval); _urgentInterval = null; } };
}

export function stopUrgentIndexer() { if (_urgentInterval) { clearInterval(_urgentInterval); _urgentInterval = null; } }
