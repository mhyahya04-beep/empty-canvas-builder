import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Maximize2, Minimize2, Trash2, Paperclip, Image as ImageIcon, FileDown, ChevronRight, FileText, LayoutList, AlertCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { CellEditor } from "./cell-editor";
import { RichTextEditor } from "./rich-editor";
import { AddFieldButton, FieldHeaderMenu } from "./field-controls";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/db";
import { useToast } from "./toast";
import { Confirm } from "./modal";
import { cn, formatDate } from "@/lib/utils";
import { useDropdown } from "./modal";

import {
  addAttachment,
  deleteRecord,
  getDocument,
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
import { exportRecordDOCX, exportRecordPDF, exportRecordJSON } from "@/lib/exporters";

import type { Attachment } from "@/lib/types";

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

export function DocumentEditor({ recordId, onClose, initialFullscreen = true }: { recordId: string | null; onClose?: () => void; initialFullscreen?: boolean; }) {
  const open = !!recordId;
  const record = useLiveQuery(() => recordId ? db.records.get(recordId) : undefined, [recordId]);
  const tableId = record?.tableId;
  const workspaceId = record?.workspaceId;

  const fields = useLiveQuery(async () => tableId ? await db.fields.where({ tableId }).sortBy("order") : [], [tableId]) ?? [];
  const attachments = useLiveQuery(() => recordId ? listAttachments(recordId) : Promise.resolve([]), [recordId]) ?? [];
  
  const [doc, setDoc] = useState<unknown>(null);
  const [docLoaded, setDocLoaded] = useState(false);
  const [title, setTitle] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [confirmDel, setConfirmDel] = useState(false);
  const [mode, setMode] = useState<"page" | "drawer">(initialFullscreen ? "page" : "drawer");
  const [showProperties, setShowProperties] = useState(true);

  const table = useLiveQuery(() => tableId ? getTable(tableId) : undefined, [tableId]);
  const workspace = useLiveQuery(() => workspaceId ? getWorkspace(workspaceId) : undefined, [workspaceId]);
  const [urgentBanner, setUrgentBanner] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const imgRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();
  const saveTimer = useRef<number | null>(null);
  const editorRef = useRef<any>(null);
  const { open: exportOpen, setOpen: setExportOpen, ref: exportRef } = useDropdown();

  useEffect(() => {
    setDocLoaded(false);
    if (!recordId) { setDoc(null); return; }
    getDocument(recordId).then((d) => { setDoc(d?.contentJson ?? null); setDocLoaded(true); });
  }, [recordId]);

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
      } catch (e) { /* ignore */ }
    })();
    const t = setTimeout(() => setUrgentBanner(null), 8000);
    return () => { mounted = false; clearTimeout(t); };
  }, [recordId]);

  useEffect(() => { if (record) setTitle(record.title); }, [record?.title]);

  const commitTitle = async () => {
    if (!record) return; 
    if (title.trim() !== record.title) { 
      setSaveStatus("saving"); 
      try { await updateRecord(record.id, { title: title.trim() || "Untitled" }); setSaveStatus("saved"); } 
      catch { setSaveStatus("error"); } 
    }
  };

  const handleDocChange = (json: unknown) => {
    setDoc(json);
    if (!recordId) return;
    setSaveStatus("saving");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => { 
      try { 
        await setDocument(recordId, json); 
        await ensureUrgentFromDoc(recordId, json); 
        setSaveStatus("saved"); 
      } catch { setSaveStatus("error"); } 
    }, 400);
  };

  const handleAddFile = async (file: File, kind: "image" | "file") => {
    if (!recordId) return;
    try {
      await addAttachment(recordId, file);
      toast({ title: "Attachment added", variant: "success" });
    } catch (e) { toast({ title: "Could not save attachment", description: (e as Error).message, variant: "error" }); }
  };

  const handleDelete = async () => { 
    if (!record) return; 
    const name = record.title; 
    await deleteRecord(record.id); 
    toast({ title: "Record deleted", description: name, variant: "success" }); 
    onClose && onClose(); 
  };

  const handleExport = async (format: 'docx' | 'pdf' | 'json') => {
    if (!recordId) return;
    setExportOpen(false);
    try {
      if (format === 'docx') await exportRecordDOCX(recordId);
      else if (format === 'pdf') await exportRecordPDF(recordId);
      else if (format === 'json') await exportRecordJSON(recordId);
      toast({ title: `Record exported as ${format.toUpperCase()}`, variant: "success" });
    } catch (e: any) {
      toast({ title: 'Export failed', description: e.message, variant: "error" });
    }
  };

  if (!open) return null;

  return (
    <div className={cn("flex-1 flex flex-col h-full bg-background transition-all duration-300", 
      mode === "drawer" ? "max-w-2xl border-l border-border ml-auto shadow-2xl" : "w-full")}>
      
      <header className="px-6 py-3 border-b border-border bg-card/30 backdrop-blur-md flex items-center justify-between shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-4 overflow-hidden">
          <nav className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground whitespace-nowrap">
            <Link to="/" className="hover:text-primary transition-colors">Archive</Link>
            {workspace && (
              <>
                <ChevronRight className="w-3 h-3 opacity-30" />
                <Link to="/space/$spaceId" params={{ spaceId: workspace.id } as any} className="hover:text-primary transition-colors truncate max-w-[120px]">{workspace.name}</Link>
              </>
            )}
            {table && (
              <>
                <ChevronRight className="w-3 h-3 opacity-30" />
                <span className="truncate max-w-[120px] opacity-60">{table.name}</span>
              </>
            )}
          </nav>
          <div className="h-4 w-px bg-border mx-1" />
          <SaveBadge status={saveStatus} />
        </div>

        <div className="flex items-center gap-1">
          <div className="relative" ref={exportRef}>
            <button onClick={() => setExportOpen(!exportOpen)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-muted text-muted-foreground text-xs font-semibold border border-transparent hover:border-border transition-all">
              <FileDown className="w-3.5 h-3.5" /> Export
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-full mt-1 z-30 w-36 rounded-lg border border-border bg-popover shadow-xl py-1 animate-in fade-in zoom-in-95 duration-200">
                <button onClick={() => handleExport('pdf')} className="w-full px-3 py-2 text-sm hover:bg-muted text-left">PDF Document</button>
                <button onClick={() => handleExport('docx')} className="w-full px-3 py-2 text-sm hover:bg-muted text-left">Word (DOCX)</button>
                <button onClick={() => handleExport('json')} className="w-full px-3 py-2 text-sm hover:bg-muted text-left">Raw JSON</button>
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-border mx-1" />

          <button onClick={() => setShowProperties(!showProperties)} className={cn("p-2 rounded-md hover:bg-muted transition-colors", showProperties ? "text-primary bg-primary/10" : "text-muted-foreground")} title="Properties">
            <LayoutList className="w-4 h-4" />
          </button>
          
          <button onClick={() => setMode(mode === "page" ? "drawer" : "page")} className="p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors" title={mode === "page" ? "Enter Drawer Mode" : "Exit Drawer Mode"}>
            {mode === "page" ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button onClick={() => setConfirmDel(true)} className="p-2 rounded-md hover:bg-muted text-destructive/70 hover:text-destructive transition-colors" title="Delete record">
            <Trash2 className="w-4 h-4" />
          </button>

          {onClose && (
            <button onClick={onClose} className="ml-1 p-2 rounded-md hover:bg-muted text-muted-foreground" title="Close">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className={cn("mx-auto px-8 py-12 transition-all duration-500", mode === "page" ? "max-w-4xl" : "max-w-full")}>
          {urgentBanner && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="mb-8 p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-900 text-sm flex items-center gap-3 shadow-sm">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
              {urgentBanner}
            </motion.div>
          )}

          <div className="mb-10 group">
            <input 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              onBlur={commitTitle} 
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} 
              placeholder="Untitled Record" 
              className="w-full bg-transparent font-display text-5xl md:text-6xl font-bold tracking-tight focus:outline-none mb-3 placeholder:text-muted-foreground/10 selection:bg-primary/20" 
            />
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-bold">
              <span>Created {formatDate(record?.createdAt)}</span>
              <span className="opacity-30">/</span>
              <span>Last Modified {formatRelativeLocal(record?.updatedAt)}</span>
            </div>
          </div>

          <AnimatePresence>
            {showProperties && fields.length > 0 && (
              <motion.section 
                initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="mb-12 overflow-hidden border-y border-border/40 py-8 bg-muted/20 -mx-8 px-8"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Metadata & Properties</h3>
                  <AddFieldButton tableId={record?.tableId} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                  {fields.map((f) => (
                    <div key={f.id} className="flex items-center gap-4 group/field">
                      <div className="flex items-center justify-between w-32 shrink-0">
                        <span className="text-[10px] text-muted-foreground/80 uppercase tracking-widest font-semibold truncate">{f.name}</span>
                        <FieldHeaderMenu field={f} />
                      </div>
                      <div className="flex-1 min-w-0 border-b border-transparent group-hover/field:border-border/50 transition-colors">
                        <CellEditor field={f} record={record as any} />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          <section className="mb-16">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-bold flex items-center gap-2">
                <Paperclip className="w-3.5 h-3.5" /> Digital Artifacts
              </h3>
              <div className="flex gap-2">
                <button onClick={() => imgRef.current?.click()} className="text-[10px] uppercase tracking-wider font-bold inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted transition-all">
                  <ImageIcon className="w-3.5 h-3.5" /> Add Image
                </button>
                <button onClick={() => fileRef.current?.click()} className="text-[10px] uppercase tracking-wider font-bold inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted transition-all">
                  <Paperclip className="w-3.5 h-3.5" /> Add File
                </button>
                <input ref={imgRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAddFile(f, "image"); e.target.value = ""; }} />
                <input ref={fileRef} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAddFile(f, "file"); e.target.value = ""; }} />
              </div>
            </div>
            
            {attachments.length === 0 ? (
              <div className="py-12 rounded-2xl border border-dashed border-border/60 bg-muted/10 text-center">
                <p className="text-xs text-muted-foreground/50 italic tracking-wide">No artifacts attached to this record.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {attachments.map((a) => (
                  <AttachmentTile 
                    key={a.id} 
                    att={a} 
                    onRemove={() => removeAttachment(a.id)} 
                    onInsert={async () => { const u = await getAttachmentDataUrl(a); if (u) editorRef.current?.insertImage(u); }} 
                  />
                ))}
              </div>
            )}
          </section>

          <section className="prose prose-stone dark:prose-invert max-w-none">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-bold mb-6 flex items-center gap-2">
              <FileText className="w-3.5 h-3.5" /> Documentation
            </h3>
            <div className="min-h-[400px] pb-32">
              {docLoaded && (<RichTextEditor ref={editorRef} initialJSON={doc} onChange={handleDocChange} />)}
            </div>
          </section>

          <Confirm 
            open={confirmDel} 
            onClose={() => setConfirmDel(false)} 
            onConfirm={handleDelete} 
            title="Delete permanently?" 
            description="This record and all its associated artifacts will be scrubbed from the local vault." 
            confirmText="Delete Record" 
            destructive 
          />
        </div>
      </div>
    </div>
  );
}

function AttachmentTile({ att, onRemove, onInsert }: { att: Attachment; onRemove: () => void; onInsert: () => void; }) {
  const [src, setSrc] = useState<string | undefined>(att.dataUrl);
  useEffect(() => { 
    let cancelled = false; 
    if (!src && att.hash) getAttachmentDataUrl(att).then((u) => { if (!cancelled) setSrc(u); }); 
    return () => { cancelled = true; }; 
  }, [att.id]);
  const isImage = att.mimeType.startsWith("image/");
  return (
    <div className="relative group rounded-lg border border-border bg-muted/40 overflow-hidden aspect-square">
      {isImage && src ? (<img src={src} alt={att.name} className="w-full h-full object-cover" />) : (
        <a href={src} download={att.name} className="flex flex-col items-center justify-center w-full h-full text-xs text-muted-foreground p-2 text-center">
          <Paperclip className="w-4 h-4 mb-1" />
          <span className="truncate w-full">{att.name}</span>
        </a>
      )}
      <div className="absolute left-1 bottom-1 flex gap-1">
        {isImage && (<button onClick={onInsert} className="px-2 py-0.5 text-xs rounded bg-black/60 text-white shadow-lg">Insert</button>)}
      </div>
      <button onClick={onRemove} className="absolute top-1 right-1 p-1 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

function SaveBadge({ status }: { status: "saved" | "saving" | "error" }) {
  const map = { 
    saved: { label: "Vault Secured", color: "bg-emerald-500" }, 
    saving: { label: "Encrypting…", color: "bg-amber-500 animate-pulse" }, 
    error: { label: "Security Breach", color: "bg-rose-500" }, 
  } as const;
  const s = map[status];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("w-1.5 h-1.5 rounded-full", s.color)} />
      <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">{s.label}</span>
    </span>
  );
}
