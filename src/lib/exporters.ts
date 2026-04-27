// Export utilities: DOCX, PDF, CSV, JSON, and readable ZIP archive
import { jsPDF } from "jspdf";
import {
  Document as DocxDoc,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table as DocxTable,
  TableRow as DocxRow,
  TableCell as DocxCell,
  WidthType,
  AlignmentType,
} from "docx";
import JSZip from "jszip";
import { db } from "./db/db";
import type { Field, RecordItem, Workspace, DatabaseTable, UrgentItem } from "./types";
import { getFieldsForTable, getRecordsForTable, getRecord, getDocument, listAttachments, getAttachmentDataUrl, getWorkspace, getTable } from "./storage";
import { formatDate } from "./utils";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

function safeFilename(name: string) {
  return (name || "untitled").replace(/[\\/:*?"<>|]/g, "_").slice(0, 200);
}

function isoDay(d = new Date()) { return d.toISOString().slice(0,10); }

// Convert Tiptap JSON to simple plain text (basic headings, lists, tasks)
function tiptapToPlain(node: unknown, depth = 0): string {
  if (!node || typeof node !== "object") return "";
  const n = node as any;
  if (n.type === "text") return n.text ?? "";
  
  let children = "";
  if (Array.isArray(n.content)) {
    children = n.content.map((c: any) => tiptapToPlain(c, depth + 1)).join("");
  }

  switch (n.type) {
    case "heading": {
      const lv = (n.attrs?.level as number) ?? 1;
      return "\n" + "#".repeat(lv) + " " + children + "\n";
    }
    case "paragraph": return children + "\n";
    case "bulletList":
    case "orderedList":
      return "\n" + children + "\n";
    case "listItem":
      return "  ".repeat(Math.max(0, depth - 1)) + "• " + children + "\n";
    case "taskItem":
      return "  ".repeat(Math.max(0, depth - 1)) + (n.attrs?.checked ? "☒ " : "☐ ") + children + "\n";
    case "blockquote": return "\n> " + children + "\n";
    case "horizontalRule": return "\n---\n";
    case "hardBreak": return "\n";
    case "codeBlock": return "\n```\n" + children + "\n```\n";
    case "doc": return children;
    default: return children;
  }
}


function formatValue(v: unknown, f: Field): string {
  if (v == null || v === "") return "";
  if ((f.type === "multiSelect") && Array.isArray(v)) {
    const opts = f.options ?? [];
    return (v as string[]).map((id) => opts.find((o) => o.id === id)?.label ?? "").filter(Boolean).join(", ");
  }
  if (f.type === "relation" && Array.isArray(v)) return (v as string[]).join(", ");
  if (f.type === "select") return f.options?.find((o) => o.id === v)?.label ?? "";
  if (f.type === "checkbox") return (v ? "true" : "false");
  return String(v);
}

function recordPropertyLines(record: RecordItem, fields: Field[]) {
  return fields.map((f) => {
    const raw = record.fields?.[f.id];
    let v = "";
    if (f.type === "date" || f.type === "dateTime") {
      v = raw ? String(raw) : "";
    } else v = formatValue(raw, f);
    return { name: f.name, value: v };
  }).filter((p) => p.value);
}

/* ---------- PDF helpers ---------- */
function pdfRecord(doc: jsPDF, record: RecordItem, fields: Field[], workspaceName: string, plain: string, attNames: string[], opts: { includeProperties?: boolean; includeNotes?: boolean; includeAttachments?: boolean }, isFirst: boolean) {
  if (!isFirst) doc.addPage();
  let y = 60;
  const W = doc.internal.pageSize.getWidth();
  const M = 56;
  const innerW = W - M * 2;

  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(120);
  doc.text(`${workspaceName} · ${record.title || "Untitled"}`, M, 40);

  doc.setFont("helvetica", "bold").setFontSize(22).setTextColor(20);
  const titleLines = doc.splitTextToSize(record.title || "Untitled", innerW);
  doc.text(titleLines, M, y);
  y += titleLines.length * 26;

  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(120);
  doc.text(`Created ${formatDate(record.createdAt)} · Updated ${formatDate(record.updatedAt)}`, M, y);
  y += 22;

  if (opts.includeProperties) {
    const props = recordPropertyLines(record, fields);
    if (props.length) {
      doc.setFontSize(10).setTextColor(60);
      for (const p of props) {
        if (y > doc.internal.pageSize.getHeight() - 60) { doc.addPage(); y = 60; }
        doc.setFont("helvetica", "bold").setTextColor(110);
        doc.text(p.name, M, y);
        doc.setFont("helvetica", "normal").setTextColor(20);
        const lines = doc.splitTextToSize(p.value, innerW - 130);
        doc.text(lines, M + 130, y);
        y += Math.max(14, lines.length * 13) + 3;
      }
      y += 8;
    }
  }

  if (opts.includeNotes && plain.trim()) {
    doc.setDrawColor(220).line(M, y, W - M, y); y += 14;
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(20).text("Notes", M, y); y += 16;
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(40);
    const lines = doc.splitTextToSize(plain.trim(), innerW);
    for (const line of lines) {
      if (y > doc.internal.pageSize.getHeight() - 60) { doc.addPage(); y = 60; }
      doc.text(line, M, y); y += 13;
    }
    y += 8;
  }

  if (opts.includeAttachments && attNames.length) {
    if (y > doc.internal.pageSize.getHeight() - 80) { doc.addPage(); y = 60; }
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(20).text("Attachments", M, y); y += 16;
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(40);
    for (const name of attNames) { doc.text("• " + name, M, y); y += 13; }
  }
}

export async function exportRecordPDF(recordId: string, opts: { includeProperties?: boolean; includeNotes?: boolean; includeAttachments?: boolean } = { includeProperties: true, includeNotes: true, includeAttachments: true }) {
  const r = await getRecord(recordId); if (!r) throw new Error("Record not found");
  const wk = r.workspaceId ? await getWorkspace(r.workspaceId) : null; if (!wk) throw new Error("Workspace not found");
  const fields = await getFieldsForTable(r.tableId);
  const docContent = await getDocument(r.id);
  const plain = docContent ? tiptapToPlain(docContent.contentJson) : "";
  const atts = await listAttachments(recordId);

  const doc = new jsPDF({ unit: "pt", format: "letter" });
  pdfRecord(doc, r, fields, wk.name, plain, atts.map((a) => a.name), opts, true);
  
  const blob = doc.output("blob");
  if (!(window as any).__v_export_no_download) {
    download(blob, `Record_${safeFilename(r.title || "untitled")}_${isoDay()}.pdf`);
  }
  return blob;
}

export async function exportRecordJSON(recordId: string) {
  const r = await getRecord(recordId); if (!r) throw new Error("Record not found");
  const fields = await getFieldsForTable(r.tableId);
  const docContent = await getDocument(r.id);
  const atts = await listAttachments(recordId);
  
  const payload = {
    type: "vault-record",
    version: 1,
    exportDate: new Date().toISOString(),
    record: r,
    fields,
    document: docContent,
    attachments: atts
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  download(blob, `Record_${safeFilename(r.title || "untitled")}_${isoDay()}.json`);
  return payload;
}


/* ---------- DOCX helpers ---------- */
function docxRecordSection(record: RecordItem, fields: Field[], plain: string, attNames: string[], opts: { includeProperties?: boolean; includeNotes?: boolean; includeAttachments?: boolean }) {
  const out: any[] = [];
  out.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: record.title || "Untitled", bold: true })] }));
  out.push(new Paragraph({ children: [new TextRun({ text: `Created ${formatDate(record.createdAt)} · Updated ${formatDate(record.updatedAt)}`, italics: true, color: "888888", size: 18 })] }));
  if (opts.includeProperties) {
    const props = recordPropertyLines(record, fields);
    for (const p of props) {
      out.push(new Paragraph({ children: [ new TextRun({ text: p.name + ": ", bold: true }), new TextRun({ text: p.value }) ] }));
    }
  }
  if (opts.includeNotes && plain.trim()) {
    out.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "Notes", bold: true })] }));
    for (const line of plain.split("\n")) out.push(new Paragraph({ children: [new TextRun(line)] }));
  }
  if (opts.includeAttachments && attNames.length) {
    out.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "Attachments", bold: true })] }));
    for (const n of attNames) out.push(new Paragraph({ children: [new TextRun({ text: "• " + n })] }));
  }
  out.push(new Paragraph({ children: [new TextRun("")] }));
  return out;
}

export async function exportRecordDOCX(recordId: string, opts: { includeProperties?: boolean; includeNotes?: boolean; includeAttachments?: boolean } = { includeProperties: true, includeNotes: true, includeAttachments: true }) {
  const r = await getRecord(recordId); if (!r) throw new Error("Record not found");
  const wk = r.workspaceId ? await getWorkspace(r.workspaceId) : null; if (!wk) throw new Error("Workspace not found");
  const fields = await getFieldsForTable(r.tableId);
  const docContent = await getDocument(r.id);
  const plain = docContent ? tiptapToPlain(docContent.contentJson) : "";
  const atts = await listAttachments(recordId);

  const docx = new DocxDoc({ sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children: [ new Paragraph({ children: [new TextRun({ text: wk.name, italics: true, color: "888888" })] }), ...docxRecordSection(r, fields, plain, atts.map((a) => a.name), opts) ] }] });
  const blob = await Packer.toBlob(docx);
  download(blob, `Record_${safeFilename(r.title || "untitled")}_${isoDay()}.docx`);
  return blob;
}

export async function exportTableCSV(tableId: string) {
  const fields = await getFieldsForTable(tableId);
  const records = await getRecordsForTable(tableId);
  const headers = ["Title", ...fields.map((f) => f.name), "Created", "Updated"];
  const rows = records.map((r) => {
    const vals = fields.map((f) => { const raw = r.fields?.[f.id]; return csvCell(formatValue(raw, f)); });
    return [csvCell(r.title), ...vals, csvCell(r.createdAt), csvCell(r.updatedAt)].join(",");
  });
  const csv = [headers.map(csvCell).join(","), ...rows].join("\n");
  const table = await getTable(tableId);
  download(new Blob([csv], { type: "text/csv" }), `Table_${safeFilename(table?.name ?? "table")}_${isoDay()}.csv`);
  return csv;
}

function csvCell(v: string) { if (v == null) return ""; if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`; return v; }

/* ---------- Full backup (JSON) ---------- */
import { exportAll } from "./storage";
export async function exportFullBackupJSON() {
  const { payload } = await exportAll();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  download(blob, `unified-app-backup-${isoDay()}.json`);
  return payload;
}

/* ---------- Workspace readable archive (ZIP of DOCX/PDF/JSON) ---------- */
export async function exportWorkspaceArchive(workspaceId: string) {
  const wk = await getWorkspace(workspaceId);
  if (!wk) throw new Error("Workspace not found");
  
  const zip = new JSZip();
  const root = zip.folder(safeFilename(wk.name)) as JSZip;
  
  // To avoid duplicate downloads during archive generation
  (window as any).__v_export_no_download = true;

  try {
    const tables = await db.tablesStore.where({ workspaceId }).sortBy('createdAt');
    const fullExport: any = { workspace: wk, tables: [] };

    for (const t of tables) {
      const tabFolder = root.folder(safeFilename(t.name)) as JSZip;
      const records = await getRecordsForTable(t.id);
      const fields = await getFieldsForTable(t.id);
      
      const tableData = { ...t, fields, records: [] as any[] };

      for (const r of records) {
        try {
          const docContent = await getDocument(r.id);
          const plain = docContent ? tiptapToPlain(docContent.contentJson) : "";
          const atts = await listAttachments(r.id);
          
          tableData.records.push({ record: r, document: docContent, attachments: atts });

          // DOCX
          const docx = new DocxDoc({ sections: [{ children: [ new Paragraph({ children: [new TextRun({ text: wk.name, italics: true, color: "888888" })] }), ...docxRecordSection(r, fields, plain, atts.map((a) => a.name), { includeProperties: true, includeNotes: true, includeAttachments: true }) ] }] });
          const rDocx = await Packer.toBlob(docx);
          tabFolder.file(`${safeFilename(r.title || 'untitled')}.docx`, rDocx);
          
          // PDF
          const rPdf = await exportRecordPDF(r.id);
          tabFolder.file(`${safeFilename(r.title || 'untitled')}.pdf`, rPdf);
          
          // JSON
          const rJson = JSON.stringify({ record: r, document: docContent, attachments: atts }, null, 2);
          tabFolder.file(`${safeFilename(r.title || 'untitled')}.json`, rJson);

        } catch (e) {
          console.warn('exportWorkspaceArchive record error', e);
        }
      }
      fullExport.tables.push(tableData);
    }

    // Add structured index
    root.file(`Workspace_Structure.json`, JSON.stringify(fullExport, null, 2));
    
    const blob = await zip.generateAsync({ type: 'blob' });
    download(blob, `Workspace_${safeFilename(wk.name)}_Archive_${isoDay()}.zip`);
    return blob;
  } finally {
    (window as any).__v_export_no_download = false;
  }
}

export async function exportWorkspaceJSON(workspaceId: string) {
  const wk = await getWorkspace(workspaceId);
  if (!wk) throw new Error("Workspace not found");
  
  const tables = await db.tablesStore.where({ workspaceId }).toArray();
  const payload: any = {
    type: "vault-workspace",
    version: 1,
    exportDate: new Date().toISOString(),
    workspace: wk,
    tables: []
  };

  for (const t of tables) {
    const fields = await getFieldsForTable(t.id);
    const records = await getRecordsForTable(t.id);
    const tableData = { ...t, fields, records: [] as any[] };
    
    for (const r of records) {
      const doc = await getDocument(r.id);
      const atts = await listAttachments(r.id);
      tableData.records.push({ record: r, document: doc, attachments: atts });
    }
    payload.tables.push(tableData);
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  download(blob, `Workspace_${safeFilename(wk.name)}_${isoDay()}.json`);
  return payload;
}


/* ---------- Urgent exports ---------- */
async function buildUrgentIndex(): Promise<(UrgentItem & { workspaceName?: string; recordTitle?: string; fieldName?: string })[]> {
  const { buildUrgentIndex: buildIndex } = await import("./urgent");
  const items = await buildIndex();
  const out: any[] = [];
  for (const it of items) {
    const copy = { ...it } as any;
    if (it.sourceRef?.recordId) {
      const r = await getRecord(it.sourceRef.recordId);
      copy.recordTitle = r?.title;
      if (r?.workspaceId) {
        const w = await getWorkspace(r.workspaceId);
        copy.workspaceName = w?.name;
      }
    }
    if (it.sourceRef?.fieldId) {
      const f = await db.fields.get(it.sourceRef.fieldId);
      copy.fieldName = f?.name;
    }
    out.push(copy);
  }
  return out;
}

export async function exportUrgentCSV() {
  const items = await buildUrgentIndex();
  const rows = [ ["Title","Workspace","Record","Field","Source","Created"].join(",") ];
  for (const it of items) rows.push([ csvCell(it.message ?? ''), csvCell(it.workspaceName ?? ''), csvCell(it.recordTitle ?? ''), csvCell(it.fieldName ?? ''), csvCell(it.sourceType ?? ''), csvCell(it.createdAt ?? '') ].join(","));
  const csv = rows.join("\n");
  download(new Blob([csv], { type: 'text/csv' }), `urgent_items_${isoDay()}.csv`);
  return csv;
}

export async function exportUrgentJSON() {
  const items = await buildUrgentIndex();
  const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
  download(blob, `urgent_items_${isoDay()}.json`);
  return items;
}

export async function exportUrgentDOCX() {
  const items = await buildUrgentIndex();
  const rows: DocxRow[] = [ new DocxRow({ children: ["Item","Workspace","Record","Field","Created"].map((h) => new DocxCell({ width: { size: 2340, type: WidthType.DXA }, children: [ new Paragraph({ children: [ new TextRun({ text: h, bold: true }) ] }) ] })) }) ];
  for (const it of items) rows.push(new DocxRow({ children: [ new DocxCell({ children: [ new Paragraph(it.message || '') ] }), new DocxCell({ children: [ new Paragraph(it.workspaceName || '') ] }), new DocxCell({ children: [ new Paragraph(it.recordTitle || '') ] }), new DocxCell({ children: [ new Paragraph(it.fieldName || '') ] }), new DocxCell({ children: [ new Paragraph(it.createdAt || '') ] }), ] }));
  const docx = new DocxDoc({ sections: [{ children: [ new Paragraph({ heading: HeadingLevel.TITLE, children: [ new TextRun({ text: 'Urgent Items', bold: true }) ] }), new DocxTable({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [2340,2340,2340,2340,2340], rows }) ] }] });
  const blob = await Packer.toBlob(docx);
  download(blob, `urgent_items_${isoDay()}.docx`);
  return blob;
}

export async function exportUrgentPDF() {
  const items = await buildUrgentIndex();
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  let y = 60; const M = 56; const W = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica','bold').setFontSize(22).text('Urgent Items', M, y); y += 24;
  doc.setFont('helvetica','normal').setFontSize(10);
  for (const it of items) {
    if (y > doc.internal.pageSize.getHeight() - 80) { doc.addPage(); y = 60; }
    doc.setFont('helvetica','bold').setFontSize(11).text(it.message || '', M, y); y += 14;
    doc.setFont('helvetica','normal').setFontSize(9).text(`${it.workspaceName ?? ''} · ${it.recordTitle ?? ''} · ${it.fieldName ?? ''}`, M, y); y += 12;
    if (it.createdAt) { doc.text(`Created: ${formatDate(it.createdAt)}`, M, y); y += 12; }
    y += 8;
  }
  const blob = doc.output('blob');
  download(blob, `urgent_items_${isoDay()}.pdf`);
  return blob;
}
