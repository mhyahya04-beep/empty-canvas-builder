// Local-only PDF / DOCX / Markdown / HTML / CSV / JSON exporters for records, spaces, urgent items.
import { jsPDF } from "jspdf";
import {
  Document as DocxDoc, Packer, Paragraph, TextRun, HeadingLevel,
  Table as DocxTable, TableRow as DocxRow, TableCell as DocxCell, WidthType, AlignmentType,
} from "docx";
import { db } from "./db";
import type { Field, RecordItem, Space } from "./types";
import { formatValue } from "./storage";
import { formatDate, isoDay, safeFilename, asDateValue, formatDateValue } from "./utils";
import type { UrgentItem } from "./urgent";

export type ExportFormat = "pdf" | "docx" | "md" | "html" | "csv" | "json";

export interface ExportOptions {
  includeProperties?: boolean;
  includeNotes?: boolean;
  includeAttachments?: boolean;
  includeArchived?: boolean;
  onlyUrgent?: boolean;
}

/* ---------- helpers ---------- */
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/** Convert Tiptap JSON to plain text + simple markdown. */
function tiptapToPlain(node: unknown, depth = 0): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { type?: string; text?: string; content?: unknown[]; attrs?: Record<string, unknown>; marks?: { type: string }[] };
  if (n.type === "text") return n.text ?? "";
  const children = Array.isArray(n.content) ? n.content.map((c) => tiptapToPlain(c, depth + 1)).join("") : "";
  switch (n.type) {
    case "heading": {
      const lv = (n.attrs?.level as number) ?? 1;
      return "\n" + "#".repeat(lv) + " " + children + "\n";
    }
    case "paragraph": return children + "\n";
    case "bulletList":
    case "orderedList":
      return children;
    case "listItem":
      return "  ".repeat(Math.max(0, depth - 1)) + "- " + children;
    case "taskList": return children;
    case "taskItem":
      return "  ".repeat(Math.max(0, depth - 1)) + (n.attrs?.checked ? "- [x] " : "- [ ] ") + children + "\n";
    case "blockquote": return "> " + children + "\n";
    case "horizontalRule": return "\n---\n";
    case "hardBreak": return "\n";
    case "codeBlock": return "```\n" + children + "\n```\n";
    case "doc":
    default: return children;
  }
}

function recordPropertyLines(record: RecordItem, fields: Field[]): { name: string; value: string }[] {
  return fields
    .filter((f) => f.type !== "createdTime" && f.type !== "updatedTime")
    .map((f) => {
      const raw = record.values?.[f.id];
      let v: string;
      if (f.type === "date" || f.type === "dateTime") {
        const dv = asDateValue(raw); v = dv ? formatDateValue(dv) : "";
      } else {
        v = formatValue(raw, f);
      }
      return { name: f.name, value: v };
    })
    .filter((p) => p.value);
}

/* ---------- PDF ---------- */
function pdfRecord(doc: jsPDF, record: RecordItem, fields: Field[], spaceName: string, plain: string, attNames: string[], opts: ExportOptions, isFirst: boolean) {
  if (!isFirst) doc.addPage();
  let y = 60;
  const W = doc.internal.pageSize.getWidth();
  const M = 56;
  const innerW = W - M * 2;

  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(120);
  doc.text(`${spaceName} · ${record.title || "Untitled"}`, M, 40);

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
    for (const name of attNames) {
      doc.text("• " + name, M, y); y += 13;
    }
  }
}

export async function exportRecordPDF(recordId: string, opts: ExportOptions = { includeProperties: true, includeNotes: true, includeAttachments: true }) {
  const r = await db.records.get(recordId); if (!r) throw new Error("Record not found");
  const sp = await db.spaces.get(r.spaceId); if (!sp) throw new Error("Space not found");
  const fields = (await db.fields.where({ spaceId: r.spaceId }).toArray()).sort((a, b) => a.order - b.order);
  const docContent = await db.documents.get(r.id);
  const plain = docContent ? tiptapToPlain(docContent.contentJson) : "";
  const atts = await db.attachments.where({ recordId }).toArray();

  const doc = new jsPDF({ unit: "pt", format: "letter" });
  pdfRecord(doc, r, fields, sp.name, plain, atts.map((a) => a.name), opts, true);
  doc.save(`VaultAtelier_Record_${safeFilename(r.title || "untitled")}_${isoDay()}.pdf`);
}

export async function exportSpacePDF(spaceId: string, opts: ExportOptions = { includeProperties: true, includeNotes: true, includeAttachments: true }) {
  const sp = await db.spaces.get(spaceId); if (!sp) throw new Error("Space not found");
  const fields = (await db.fields.where({ spaceId }).toArray()).sort((a, b) => a.order - b.order);
  let records = await db.records.where({ spaceId }).toArray();
  if (!opts.includeArchived) records = records.filter((r) => !r.archived);
  if (opts.onlyUrgent) records = records.filter((r) => r.urgent);
  records.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

  const doc = new jsPDF({ unit: "pt", format: "letter" });
  // Cover
  let y = 80;
  doc.setFont("helvetica", "bold").setFontSize(28).setTextColor(20);
  doc.text(sp.name, 56, y); y += 30;
  doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(120);
  if (sp.description) { const l = doc.splitTextToSize(sp.description, 480); doc.text(l, 56, y); y += l.length * 14 + 10; }
  doc.text(`Exported ${formatDate(new Date().toISOString())} · ${records.length} records`, 56, y);

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const docContent = await db.documents.get(r.id);
    const plain = docContent ? tiptapToPlain(docContent.contentJson) : "";
    const atts = await db.attachments.where({ recordId: r.id }).toArray();
    pdfRecord(doc, r, fields, sp.name, plain, atts.map((a) => a.name), opts, false);
  }
  doc.save(`VaultAtelier_Space_${safeFilename(sp.name)}_${isoDay()}.pdf`);
}

export async function exportUrgentPDF(items: UrgentItem[]) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  let y = 60; const M = 56; const W = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold").setFontSize(22).setTextColor(20).text("Urgent Items", M, y); y += 24;
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(120);
  doc.text(`${items.length} item${items.length === 1 ? "" : "s"} · Exported ${formatDate(new Date().toISOString())}`, M, y); y += 22;
  doc.setDrawColor(220).line(M, y, W - M, y); y += 14;
  for (const it of items) {
    if (y > doc.internal.pageSize.getHeight() - 80) { doc.addPage(); y = 60; }
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(20);
    doc.text(it.title, M, y); y += 14;
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(110);
    const meta = [it.spaceName, it.recordTitle, it.fieldName, it.sourceType].filter(Boolean).join(" · ");
    doc.text(meta, M, y); y += 12;
    if (it.dueDate) { doc.text(`Due: ${formatDate(it.dueDate)}`, M, y); y += 12; }
    if (it.previewText) { const l = doc.splitTextToSize(it.previewText, W - M * 2); doc.text(l, M, y); y += l.length * 11; }
    y += 10;
  }
  doc.save(`VaultAtelier_UrgentItems_${isoDay()}.pdf`);
}

/* ---------- DOCX ---------- */
function docxRecordSection(record: RecordItem, fields: Field[], plain: string, attNames: string[], opts: ExportOptions): Paragraph[] {
  const out: Paragraph[] = [];
  out.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text: record.title || "Untitled", bold: true })],
  }));
  out.push(new Paragraph({
    children: [new TextRun({ text: `Created ${formatDate(record.createdAt)} · Updated ${formatDate(record.updatedAt)}`, italics: true, color: "888888", size: 18 })],
  }));
  if (opts.includeProperties) {
    const props = recordPropertyLines(record, fields);
    for (const p of props) {
      out.push(new Paragraph({
        children: [
          new TextRun({ text: p.name + ": ", bold: true }),
          new TextRun({ text: p.value }),
        ],
      }));
    }
  }
  if (opts.includeNotes && plain.trim()) {
    out.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "Notes", bold: true })] }));
    for (const line of plain.split("\n")) {
      out.push(new Paragraph({ children: [new TextRun(line)] }));
    }
  }
  if (opts.includeAttachments && attNames.length) {
    out.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "Attachments", bold: true })] }));
    for (const n of attNames) out.push(new Paragraph({ children: [new TextRun({ text: "• " + n })] }));
  }
  out.push(new Paragraph({ children: [new TextRun("")] }));
  return out;
}

export async function exportRecordDOCX(recordId: string, opts: ExportOptions = { includeProperties: true, includeNotes: true, includeAttachments: true }) {
  const r = await db.records.get(recordId); if (!r) throw new Error("Record not found");
  const sp = await db.spaces.get(r.spaceId); if (!sp) throw new Error("Space not found");
  const fields = (await db.fields.where({ spaceId: r.spaceId }).toArray()).sort((a, b) => a.order - b.order);
  const docContent = await db.documents.get(r.id);
  const plain = docContent ? tiptapToPlain(docContent.contentJson) : "";
  const atts = await db.attachments.where({ recordId }).toArray();

  const docx = new DocxDoc({
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children: [
        new Paragraph({ children: [new TextRun({ text: sp.name, italics: true, color: "888888" })] }),
        ...docxRecordSection(r, fields, plain, atts.map((a) => a.name), opts),
      ],
    }],
  });
  const blob = await Packer.toBlob(docx);
  download(blob, `VaultAtelier_Record_${safeFilename(r.title || "untitled")}_${isoDay()}.docx`);
}

export async function exportSpaceDOCX(spaceId: string, opts: ExportOptions = { includeProperties: true, includeNotes: true, includeAttachments: true }) {
  const sp = await db.spaces.get(spaceId); if (!sp) throw new Error("Space not found");
  const fields = (await db.fields.where({ spaceId }).toArray()).sort((a, b) => a.order - b.order);
  let records = await db.records.where({ spaceId }).toArray();
  if (!opts.includeArchived) records = records.filter((r) => !r.archived);
  if (opts.onlyUrgent) records = records.filter((r) => r.urgent);
  records.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

  const children: Paragraph[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: sp.name, bold: true })] }),
    new Paragraph({ children: [new TextRun({ text: sp.description || "", italics: true })] }),
    new Paragraph({ children: [new TextRun({ text: `Exported ${formatDate(new Date().toISOString())} · ${records.length} records`, color: "888888" })] }),
    new Paragraph({ children: [new TextRun("")] }),
  ];
  for (const r of records) {
    const docContent = await db.documents.get(r.id);
    const plain = docContent ? tiptapToPlain(docContent.contentJson) : "";
    const atts = await db.attachments.where({ recordId: r.id }).toArray();
    children.push(...docxRecordSection(r, fields, plain, atts.map((a) => a.name), opts));
  }
  const docx = new DocxDoc({
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children,
    }],
  });
  const blob = await Packer.toBlob(docx);
  download(blob, `VaultAtelier_Space_${safeFilename(sp.name)}_${isoDay()}.docx`);
}

export async function exportUrgentDOCX(items: UrgentItem[]) {
  const rows: DocxRow[] = [
    new DocxRow({ children: ["Item", "Source", "Field", "Due"].map((h) =>
      new DocxCell({ width: { size: 2340, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })] })) }),
    ...items.map((it) => new DocxRow({
      children: [
        new DocxCell({ width: { size: 2340, type: WidthType.DXA }, children: [new Paragraph(it.title)] }),
        new DocxCell({ width: { size: 2340, type: WidthType.DXA }, children: [new Paragraph(`${it.spaceName ?? ""} / ${it.recordTitle ?? ""}`)] }),
        new DocxCell({ width: { size: 2340, type: WidthType.DXA }, children: [new Paragraph(it.fieldName ?? it.sourceType)] }),
        new DocxCell({ width: { size: 2340, type: WidthType.DXA }, children: [new Paragraph(it.dueDate ? formatDate(it.dueDate) : "")] }),
      ],
    })),
  ];
  const docx = new DocxDoc({
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children: [
        new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.LEFT, children: [new TextRun({ text: "Urgent Items", bold: true })] }),
        new Paragraph({ children: [new TextRun({ text: `${items.length} item${items.length === 1 ? "" : "s"}`, italics: true })] }),
        new Paragraph({ children: [new TextRun("")] }),
        new DocxTable({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [2340, 2340, 2340, 2340], rows }),
      ],
    }],
  });
  const blob = await Packer.toBlob(docx);
  download(blob, `VaultAtelier_UrgentItems_${isoDay()}.docx`);
}

/* ---------- Markdown / HTML ---------- */
export async function exportRecordMarkdown(recordId: string, opts: ExportOptions = { includeProperties: true, includeNotes: true, includeAttachments: true }) {
  const r = await db.records.get(recordId); if (!r) throw new Error("Record not found");
  const sp = await db.spaces.get(r.spaceId); if (!sp) throw new Error("Space not found");
  const fields = (await db.fields.where({ spaceId: r.spaceId }).toArray()).sort((a, b) => a.order - b.order);
  const docContent = await db.documents.get(r.id);
  const plain = docContent ? tiptapToPlain(docContent.contentJson) : "";
  const atts = await db.attachments.where({ recordId }).toArray();

  let md = `# ${r.title || "Untitled"}\n\n_${sp.name} · ${formatDate(r.updatedAt)}_\n\n`;
  if (opts.includeProperties) {
    const props = recordPropertyLines(r, fields);
    if (props.length) {
      md += props.map((p) => `**${p.name}:** ${p.value}`).join("  \n") + "\n\n";
    }
  }
  if (opts.includeNotes && plain.trim()) md += "## Notes\n\n" + plain.trim() + "\n\n";
  if (opts.includeAttachments && atts.length) {
    md += "## Attachments\n\n" + atts.map((a) => `- ${a.name}`).join("\n") + "\n";
  }
  download(new Blob([md], { type: "text/markdown" }), `VaultAtelier_Record_${safeFilename(r.title || "untitled")}_${isoDay()}.md`);
}

export async function exportRecordHTML(recordId: string, opts: ExportOptions = { includeProperties: true, includeNotes: true, includeAttachments: true }) {
  const r = await db.records.get(recordId); if (!r) throw new Error("Record not found");
  const sp = await db.spaces.get(r.spaceId); if (!sp) throw new Error("Space not found");
  const fields = (await db.fields.where({ spaceId: r.spaceId }).toArray()).sort((a, b) => a.order - b.order);
  const docContent = await db.documents.get(r.id);
  const plain = docContent ? tiptapToPlain(docContent.contentJson) : "";
  const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
  let body = `<h1>${escape(r.title || "Untitled")}</h1><p><em>${escape(sp.name)} · ${formatDate(r.updatedAt)}</em></p>`;
  if (opts.includeProperties) {
    const props = recordPropertyLines(r, fields);
    if (props.length) {
      body += `<table style="border-collapse:collapse;margin:1em 0">${props.map((p) => `<tr><td style="padding:6px 12px;color:#888"><strong>${escape(p.name)}</strong></td><td style="padding:6px 12px">${escape(p.value)}</td></tr>`).join("")}</table>`;
    }
  }
  if (opts.includeNotes && plain.trim()) body += `<h2>Notes</h2><pre style="white-space:pre-wrap;font-family:inherit">${escape(plain.trim())}</pre>`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escape(r.title || "Untitled")}</title><style>body{font-family:Georgia,serif;max-width:680px;margin:40px auto;padding:0 24px;color:#1a1a1a}h1,h2{font-family:'Cormorant Garamond',serif}</style></head><body>${body}</body></html>`;
  download(new Blob([html], { type: "text/html" }), `VaultAtelier_Record_${safeFilename(r.title || "untitled")}_${isoDay()}.html`);
}

/* ---------- CSV / JSON pass-throughs ---------- */
export async function downloadSpaceCSV(spaceId: string) {
  const { exportSpaceCSV } = await import("./storage");
  const sp = await db.spaces.get(spaceId);
  const csv = await exportSpaceCSV(spaceId);
  download(new Blob([csv], { type: "text/csv" }), `VaultAtelier_Space_${safeFilename(sp?.name ?? "space")}_${isoDay()}.csv`);
}

export function downloadJSON(data: unknown, name: string) {
  download(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), `VaultAtelier_${name}_${isoDay()}.json`);
}

export function urgentToCSV(items: UrgentItem[]): string {
  const rows = [
    ["Title", "Space", "Record", "Field", "Source", "Due", "Updated"].join(","),
    ...items.map((it) => [it.title, it.spaceName, it.recordTitle, it.fieldName, it.sourceType, it.dueDate ? formatDate(it.dueDate) : "", formatDate(it.updatedAt)]
      .map((c) => c == null ? "" : /[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : String(c)).join(",")),
  ];
  return rows.join("\n");
}

export type _Reexports = Space | RecordItem | Field;
