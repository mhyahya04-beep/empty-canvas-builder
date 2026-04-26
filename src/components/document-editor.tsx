import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Maximize2, Minimize2, Trash2, Paperclip, Image as ImageIcon } from "lucide-react";
import { CellEditor } from "./cell-editor";
import { RichTextEditor } from "./rich-editor";
import { AddFieldButton, FieldHeaderMenu } from "./field-controls";
import { useToast } from "./ui/toast";
import { Confirm } from "./modal";
import { cn, formatDate } from "@/lib/utils";

function formatRelativeLocal(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const days = Math.floor(diff / 86400);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}
import {
  addAttachment,
  deleteRecord,
  getDocument,
  getFieldsForTable,
  getRecord,
  listAttachments,
  removeAttachment,
  setDocument,
  updateRecord,
  getAttachmentDataUrl,
  getTable,
  getWorkspace,
  ensureUrgentFromDoc,
  getUrgentItem,
} from "@/lib/storage";
import { exportRecordDOCX, exportRecordPDF } from "@/lib/exporters";
import type { Attachment } from "@/lib/types";

export function DocumentEditor({ recordId, onClose, fullscreen = false }: { recordId: string | null; onClose?: () => void; fullscreen?: boolean; }) {
  const open = !!recordId;
  const [record, setRecord] = useState<any | null>(null);
  const [fields, setFields] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [doc, setDoc] = useState<unknown>(null);
  const [docLoaded, setDocLoaded] = useState(false);
  const [title, setTitle] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [confirmDel, setConfirmDel] = useState(false);
  const [table, setTable] = useState<any | null>(null);
  const [workspace, setWorkspace] = useState<any | null>(null);
  const [urgentBanner, setUrgentBanner] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const imgRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();
  const saveTimer = useRef<number | null>(null);
  const editorRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;
    setDocLoaded(false);
    if (!recordId) { setRecord(null); setFields([]); setAttachments([]); setDoc(null); return; }
    (async () => {
      const r = await getRecord(recordId);
      if (!mounted) return;
      setRecord(r ?? null);
      setTitle(r?.title ?? "");
      const f = r ? await getFieldsForTable(r.tableId) : [];
      if (!mounted) return;
      setFields(f);
      const at = await listAttachments(recordId);
      if (!mounted) return;
      setAttachments(at);
      const d = await getDocument(recordId);
      if (!mounted) return;
      setDoc(d?.contentJson ?? null); setDocLoaded(true);
      const t = r?.tableId ? await getTable(r.tableId) : null; if (!mounted) return; setTable(t ?? null);
      const w = r?.workspaceId ? await getWorkspace(r.workspaceId) : null; if (!mounted) return; setWorkspace(w ?? null);
    })();
    const iv = setInterval(async () => {
      if (!recordId) return;
      const r = await getRecord(recordId);
      setRecord(r ?? null);
      setFields(r ? await getFieldsForTable(r.tableId) : []);
      setAttachments(await listAttachments(recordId));
    }, 1200);
    return () => { mounted = false; clearInterval(iv); };
  }, [recordId]);

  // show urgent banner when opened via urgent link
  useEffect(() => {
    let mounted = true;
    if (!recordId) { setUrgentBanner(null); return; }
    const params = new URLSearchParams(window.location.search);
    const urgentId = params.get('urgentId');
    if (!urgentId) { setUrgentBanner(null); return; }
    (async () => {
      try {
        const it = await getUrgentItem(urgentId);
        if (!mounted) return;
        if (it && it.sourceRef?.recordId === recordId) setUrgentBanner(it.message ?? 'Urgent item is inside this page.');
        else setUrgentBanner('Urgent item is inside this page.');
      } catch (e) { /* ignore */ }
    })();
    const t = setTimeout(() => setUrgentBanner(null), 8000);
    return () => { mounted = false; clearTimeout(t); };
  }, [recordId]);

  useEffect(() => { if (record) setTitle(record.title); }, [record?.id]);

  const commitTitle = async () => {
    if (!record) return; if (title.trim() !== record.title) { setSaveStatus("saving"); try { await updateRecord(record.id, { title: title.trim() || "Untitled" }); setSaveStatus("saved"); } catch { setSaveStatus("error"); } }
  };

  const handleDocChange = (json: unknown) => {
    setDoc(json);
    if (!recordId) return;
    setSaveStatus("saving");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => { try { await setDocument(recordId, json); await ensureUrgentFromDoc(recordId, json); setSaveStatus("saved"); } catch { setSaveStatus("error"); } }, 400);
  };

  const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(fr.result as string); fr.onerror = () => reject(fr.error); fr.readAsDataURL(file); });

  const handleAddFile = async (file: File, kind: "image" | "file") => {
    if (!recordId) return;
    if (kind === "image" && !file.type.startsWith("image/")) { toast({ title: "Unsupported file type" }); return; }
    try {
      if (kind === "image") {
        const dataUrl = await fileToDataUrl(file);
        editorRef.current?.insertImage(dataUrl);
        await addAttachment(recordId, file);
        setAttachments(await listAttachments(recordId));
        toast({ title: "Image inserted and saved" });
      } else {
        await addAttachment(recordId, file);
        setAttachments(await listAttachments(recordId));
        toast({ title: "Attachment added" });
      }
    } catch (e) { toast({ title: "Could not save attachment", description: (e as Error).message }); }
  };

  const handleDelete = async () => { if (!record) return; const name = record.title; await deleteRecord(record.id); toast({ title: "Record deleted", description: name }); onClose && onClose(); };

  const exportRecord = async () => {
    if (!recordId) return;
    const choice = window.prompt("Export format (docx / pdf / json). Leave empty to cancel:");
    if (!choice) return;
    try {
      if (choice === 'docx') {
        await exportRecordDOCX(recordId);
        toast({ title: 'Record exported (DOCX)' });
      } else if (choice === 'pdf') {
        const blob = await exportRecordPDF(recordId);
        downloadBlob(blob, `record-${recordId}.pdf`);
        toast({ title: 'Record exported (PDF)' });
      } else if (choice === 'json') {
        const r = await getRecord(recordId);
        const d = await getDocument(recordId);
        const atts = await listAttachments(recordId);
        const items = await Promise.all(atts.map(async (a) => ({ ...(a as any), dataUrl: await getAttachmentDataUrl(a) })));
        const payload = { record: r, document: d, attachments: items, fields };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        downloadBlob(blob, `record-${recordId}.json`);
        toast({ title: 'Record exported (JSON)' });
      } else {
        toast({ title: 'Unknown export format' });
      }
    } catch (e: any) {
      toast({ title: 'Export failed: ' + (e?.message ?? String(e)) });
    }
  };

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  if (!open) return null;

  return (
    <div className={cn("flex-1 overflow-y-auto")}> 
      <div className={cn("mx-auto px-8 py-8", fullscreen ? "max-w-3xl" : "")}> 
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <SaveBadge status={saveStatus} />
            <span>·</span>
            {record && <span>Updated {formatRelativeLocal(record.updatedAt)}</span>}
            <div className="ml-3">{workspace && table && (<span>{workspace.name} / {table.name}</span>)}</div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={exportRecord} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground text-xs">Export</button>
            <button onClick={() => setConfirmDel(true)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground text-xs" title="Delete record"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>

        {urgentBanner && (
          <div className="mb-4 p-3 rounded border border-urgent-bg bg-urgent/10 text-urgent text-sm">
            {urgentBanner}
          </div>
        )}

        <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={commitTitle} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} placeholder="Untitled" className="w-full bg-transparent font-display text-3xl md:text-4xl font-semibold tracking-tight focus:outline-none mb-2 placeholder:text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground mb-6">Created {formatDate(record?.createdAt)}</p>

        {fields.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Properties</h3>
              <AddFieldButton tableId={record?.tableId} />
            </div>
            <table className="w-full">
              <tbody>
                {fields.map((f) => (
                  <tr key={f.id} className="align-top">
                    <td className="text-xs text-muted-foreground uppercase tracking-wider py-1.5 pr-4 w-40 flex items-center justify-between">
                      <span>{f.name}</span>
                      <FieldHeaderMenu field={f} />
                    </td>
                    <td className="py-0.5"><CellEditor field={f} record={record} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Attachments</h3>
            <div className="flex gap-1">
              <button onClick={() => imgRef.current?.click()} className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-muted text-muted-foreground"><ImageIcon className="w-3 h-3" /> Image</button>
              <button onClick={() => fileRef.current?.click()} className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-muted text-muted-foreground"><Paperclip className="w-3 h-3" /> File</button>
              <input ref={imgRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAddFile(f, "image"); e.target.value = ""; }} />
              <input ref={fileRef} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAddFile(f, "file"); e.target.value = ""; }} />
            </div>
          </div>
          {attachments.length === 0 ? (<p className="text-xs text-muted-foreground italic">No attachments yet.</p>) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {attachments.map((a) => (<AttachmentTile key={a.id} att={a} onRemove={() => removeAttachment(a.id)} onInsert={async () => { const u = await getAttachmentDataUrl(a); if (u) editorRef.current?.insertImage(u); }} />))}
            </div>
          )}
        </section>

        <section>
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Notes</h3>
          {docLoaded && (<RichTextEditor ref={editorRef} initialJSON={doc} onChange={handleDocChange} />)}
        </section>
        <Confirm open={confirmDel} onClose={() => setConfirmDel(false)} onConfirm={handleDelete} title={`Delete "${record?.title}"?`} description="This record and its notes will be permanently removed." confirmText="Delete" destructive />
      </div>
    </div>
  );
}

// confirm delete modal
// placed after component so JSX scope is clear


function AttachmentTile({ att, onRemove, onInsert }: { att: Attachment; onRemove: () => void; onInsert: () => void; }) {
  const [src, setSrc] = useState<string | undefined>((att as any).dataUrl);
  useEffect(() => { let cancelled = false; if (!src && att.hash) getAttachmentDataUrl(att).then((u) => { if (!cancelled) setSrc(u); }); return () => { cancelled = true; }; }, [att.id]);
  const isImage = att.mimeType.startsWith("image/");
  return (
    <div className="relative group rounded-lg border border-border bg-muted/40 overflow-hidden aspect-square">
      {isImage && src ? (<img src={src} alt={att.name} className="w-full h-full object-cover" />) : (
        <a href={src} download={att.name} className="flex flex-col items-center justify-center w-full h-full text-xs text-muted-foreground p-2 text-center"><Paperclip className="w-4 h-4 mb-1" /><span className="truncate w-full">{att.name}</span></a>
      )}
      <div className="absolute left-1 bottom-1 flex gap-1">
        {isImage && (<button onClick={onInsert} className="px-2 py-0.5 text-xs rounded bg-black/60 text-white">Insert</button>)}
      </div>
      <button onClick={onRemove} className="absolute top-1 right-1 p-1 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
    </div>
  );
}

function SaveBadge({ status }: { status: "saved" | "saving" | "error" }) {
  const map = { saved: { label: "Saved locally", color: "bg-tag-sage" }, saving: { label: "Saving…", color: "bg-tag-gold animate-pulse" }, error: { label: "Error saving", color: "bg-destructive" }, } as const;
  const s = map[status];
  return (
    <span className="inline-flex items-center gap-1.5"><span className={cn("w-1.5 h-1.5 rounded-full", s.color)} /><span className="text-xs">{s.label}</span></span>
  );
}
