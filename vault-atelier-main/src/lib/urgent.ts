// Urgent indexer — derives urgent items from records, fields, and documents.
import { db } from "./db";
import type { Field, RecordItem, Space } from "./types";
import { fieldValueIsUrgent, asDateValue, isDateValue } from "./utils";

export type UrgentSourceType =
  | "record" | "tableCell" | "property" | "bullet" | "checklist"
  | "highlightedText" | "deadline" | "status" | "tag";

export interface UrgentItem {
  id: string;
  spaceId: string;
  spaceName?: string;
  spaceIcon?: string;
  recordId?: string;
  recordTitle?: string;
  fieldId?: string;
  fieldName?: string;
  sourceType: UrgentSourceType;
  title: string;
  previewText?: string;
  dueDate?: string;
  updatedAt: string;
}

/** Walk Tiptap JSON and collect bullets/checks/marks flagged as urgent. */
function walkDoc(node: unknown, hits: { kind: UrgentSourceType; text: string }[]) {
  if (!node || typeof node !== "object") return;
  const n = node as { type?: string; text?: string; marks?: { type: string; attrs?: Record<string, unknown> }[]; attrs?: Record<string, unknown>; content?: unknown[] };
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
  const n = node as { text?: string; content?: unknown[] };
  if (n.text) return n.text;
  if (Array.isArray(n.content)) return n.content.map(extractText).join("");
  return "";
}

export async function buildUrgentIndex(): Promise<UrgentItem[]> {
  const [spaces, fields, records, docs] = await Promise.all([
    db.spaces.toArray(),
    db.fields.toArray(),
    db.records.toArray(),
    db.documents.toArray(),
  ]);
  const spaceById = new Map<string, Space>(spaces.map((s) => [s.id, s]));
  const fieldsBySpace = new Map<string, Field[]>();
  for (const f of fields) {
    const a = fieldsBySpace.get(f.spaceId) ?? [];
    a.push(f); fieldsBySpace.set(f.spaceId, a);
  }
  const docByRecord = new Map(docs.map((d) => [d.recordId, d]));
  const out: UrgentItem[] = [];

  for (const r of records) {
    if (r.archived) continue;
    const sp = spaceById.get(r.spaceId);
    if (!sp || sp.archived) continue;
    const baseMeta = {
      spaceId: r.spaceId, spaceName: sp.name, spaceIcon: sp.icon,
      recordId: r.id, recordTitle: r.title || "Untitled",
      updatedAt: r.updatedAt,
    };
    // Per-record urgent flag
    if (r.urgent) {
      out.push({ ...baseMeta, id: `rec:${r.id}`, sourceType: "record", title: r.title || "Untitled" });
    }
    // Field values
    const sf = fieldsBySpace.get(r.spaceId) ?? [];
    for (const f of sf) {
      const v = r.values?.[f.id];
      if (v == null || v === "") continue;
      if (fieldValueIsUrgent(f, v)) {
        const sourceType: UrgentSourceType =
          f.type === "status" ? "status" : (f.type === "select" ? "property" : "tag");
        out.push({
          ...baseMeta, id: `fv:${r.id}:${f.id}`, sourceType,
          fieldId: f.id, fieldName: f.name,
          title: r.title || "Untitled", previewText: `${f.name}: Urgent`,
        });
      }
      // Deadlines (date within 7 days, or past due)
      if ((f.type === "date" || f.type === "dateTime")) {
        const dv = asDateValue(v);
        if (dv?.start) {
          const t = new Date(dv.start).getTime();
          const days = (t - Date.now()) / (1000 * 60 * 60 * 24);
          if (days <= 7) {
            out.push({
              ...baseMeta, id: `dl:${r.id}:${f.id}`, sourceType: "deadline",
              fieldId: f.id, fieldName: f.name,
              title: r.title || "Untitled",
              previewText: days < 0 ? "Past due" : "Due soon",
              dueDate: dv.start,
            });
          }
        } else if (typeof v === "string") {
          const t = new Date(v).getTime();
          if (!isNaN(t)) {
            const days = (t - Date.now()) / (1000 * 60 * 60 * 24);
            if (days <= 7) {
              out.push({
                ...baseMeta, id: `dl:${r.id}:${f.id}`, sourceType: "deadline",
                fieldId: f.id, fieldName: f.name,
                title: r.title || "Untitled",
                previewText: days < 0 ? "Past due" : "Due soon",
                dueDate: v,
              });
            }
          }
        }
      }
      void isDateValue;
    }
    // Document hits
    const doc = docByRecord.get(r.id);
    if (doc?.contentJson) {
      const hits: { kind: UrgentSourceType; text: string }[] = [];
      walkDoc(doc.contentJson, hits);
      hits.forEach((h, i) => {
        out.push({
          ...baseMeta,
          id: `doc:${r.id}:${i}`,
          sourceType: h.kind,
          title: h.text || r.title || "Urgent note",
          previewText: `Inside: ${r.title || "Untitled"}`,
        });
      });
    }
  }

  // newest first
  out.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  return out;
}
