import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/db";
import {
  addAttachment, deleteRecord, getDocument, listAttachments, removeAttachment,
  setDocument, updateRecord, getAttachmentDataUrl, toggleUrgentRecord,
} from "@/lib/storage";
import type { Attachment } from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";
import { X, Maximize2, Minimize2, Trash2, Paperclip, Image as ImageIcon, AlertCircle, ChevronRight, LayoutList, FileText, Settings2 } from "lucide-react";
import { CellEditor } from "./cell-editor";
import { RichTextEditor } from "./rich-editor";
import { useToast } from "./toast";
import { Confirm } from "./modal";
import { cn, formatDate, formatRelative } from "@/lib/utils";

export function RecordDrawer({ recordId, onClose }: { recordId: string | null; onClose: () => void }) {
  const open = !!recordId;
  const record = useLiveQuery(() => recordId ? db.records.get(recordId) : undefined, [recordId]);
  
  // Adapt to merged model: records have workspaceId instead of spaceId
  const workspaceId = record?.workspaceId;
  const tableId = record?.tableId;

  const fields = useLiveQuery(async () =>
    tableId ? await db.fields.where({ tableId }).sortBy("order") : [],
    [tableId]
  ) ?? [];
  
  const attachments = useLiveQuery(() => recordId ? listAttachments(recordId) : Promise.resolve([]), [recordId]) ?? [];
  const [doc, setDoc] = useState<unknown>(null);
  const [docLoaded, setDocLoaded] = useState(false);
  const [title, setTitle] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [showProperties, setShowProperties] = useState(true);
  const [confirmDel, setConfirmDel] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const saveTimer = useRef<number | null>(null);

  // Load document content & title when record changes
  useEffect(() => {
    setDocLoaded(false);
    if (!recordId) return;
    getDocument(recordId).then((d) => { setDoc(d?.contentJson ?? null); setDocLoaded(true); });
  }, [recordId]);
  useEffect(() => { if (record) setTitle(record.title); }, [record?.id]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !confirmDel) onClose();
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, onClose, confirmDel]);

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
      try { await setDocument(recordId, json); setSaveStatus("saved"); }
      catch { setSaveStatus("error"); }
    }, 400);
  };

  const handleAddFile = async (file: File, kind: "image" | "file") => {
    if (!recordId) return;
    if (kind === "image" && !file.type.startsWith("image/")) {
      toast({ title: "Unsupported file type", description: "Please pick an image.", variant: "error" });
      return;
    }
    try {
      await addAttachment(recordId, file);
      toast({ title: "Attachment added", variant: "success" });
    } catch (e) {
      toast({ title: "Could not save attachment", description: (e as Error).message, variant: "error" });
    }
  };

  const handleDelete = async () => {
    if (!record) return;
    const name = record.title;
    await deleteRecord(record.id);
    toast({ title: "Record deleted", description: name, variant: "success" });
    onClose();
  };

  return (
    <AnimatePresence>
      {open && record && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 280, damping: 32 }}
            className={cn("fixed top-0 right-0 z-50 h-full bg-card border-l border-border shadow-2xl flex flex-col",
              fullscreen ? "w-full" : "w-full md:w-[680px] lg:w-[760px]")}
          >
            <header className="px-4 py-2.5 border-b border-border flex items-center justify-between gap-2 shrink-0 bg-card/50 backdrop-blur-sm">
              <div className="flex items-center gap-3 overflow-hidden">
                <nav className="flex items-center gap-2 text-[11px] text-muted-foreground whitespace-nowrap overflow-hidden">
                  <div className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-default">
                    <FileText className="w-3.5 h-3.5" />
                    <span className="truncate max-w-[100px]">{(record as any).workspaceName || "Archive"}</span>
                  </div>
                  <ChevronRight className="w-3 h-3 opacity-40 shrink-0" />
                  <div className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-default">
                    <LayoutList className="w-3.5 h-3.5" />
                    <span className="truncate max-w-[100px]">{(record as any).tableName || "Table"}</span>
                  </div>
                </nav>
                <div className="h-4 w-px bg-border mx-1 shrink-0" />
                <SaveBadge status={saveStatus} />
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setShowProperties(!showProperties)} className={cn("p-1.5 rounded-md hover:bg-muted transition-colors", showProperties ? "text-primary bg-primary/10" : "text-muted-foreground")} title="Toggle Properties">
                  <Settings2 className="w-4 h-4" />
                </button>
                <button onClick={() => toggleUrgentRecord(record.id)} className={cn("p-1.5 rounded-md hover:bg-muted transition-colors", record.urgent ? "text-orange-500" : "text-muted-foreground")} title="Mark as Urgent">
                  <AlertCircle className={cn("w-4 h-4", record.urgent && "fill-orange-500/20")} />
                </button>
                <button onClick={() => setConfirmDel(true)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground" title="Delete record">
                  <Trash2 className="w-4 h-4" />
                </button>
                <button onClick={() => setFullscreen(!fullscreen)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground" title="Fullscreen">
                  {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground" title="Close (Esc)">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto">
              <div className={cn("mx-auto px-8 py-8", fullscreen ? "max-w-3xl" : "")}>
                <div className="mb-4">
                  <input
                    value={title} onChange={(e) => setTitle(e.target.value)} onBlur={commitTitle}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    placeholder="Document Title"
                    className="w-full bg-transparent font-display text-4xl md:text-5xl font-bold tracking-tight focus:outline-none mb-1 placeholder:text-muted-foreground/20"
                  />
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground uppercase tracking-widest">
                    <span>Created {formatDate(record.createdAt)}</span>
                    <span>·</span>
                    <span>Updated {formatRelative(record.updatedAt)}</span>
                  </div>
                </div>

                <AnimatePresence>
                  {showProperties && fields.length > 0 && (
                    <motion.section 
                      initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="mb-10 overflow-hidden border-b border-border/50 pb-8 pt-4"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-3">
                        {fields.map((f) => (
                          <div key={f.id} className="flex items-center gap-4 py-1 border-b border-border/30 last:border-0 sm:border-0">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest w-24 shrink-0 font-semibold">{f.name}</span>
                            <div className="flex-1 min-w-0"><CellEditor field={f} record={record} /></div>
                          </div>
                        ))}
                      </div>
                    </motion.section>
                  )}
                </AnimatePresence>

                {/* Attachments */}
                <section className="mb-8">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Attachments</h3>
                    <div className="flex gap-1">
                      <button onClick={() => imgRef.current?.click()} className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-muted text-muted-foreground">
                        <ImageIcon className="w-3 h-3" /> Image
                      </button>
                      <button onClick={() => fileRef.current?.click()} className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-muted text-muted-foreground">
                        <Paperclip className="w-3 h-3" /> File
                      </button>
                      <input ref={imgRef} type="file" accept="image/*" hidden
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAddFile(f, "image"); e.target.value = ""; }} />
                      <input ref={fileRef} type="file" hidden
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAddFile(f, "file"); e.target.value = ""; }} />
                    </div>
                  </div>
                  {attachments.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No attachments yet.</p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {attachments.map((a) => (
                        <AttachmentTile key={a.id} att={a} onRemove={() => removeAttachment(a.id)} />
                      ))}
                    </div>
                  )}
                </section>

                {/* Document */}
                <section>
                  <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Notes</h3>
                  {docLoaded && (
                    <RichTextEditor initialJSON={doc} onChange={handleDocChange} />
                  )}
                </section>
              </div>
            </div>
          </motion.aside>
          <Confirm open={confirmDel} onClose={() => setConfirmDel(false)} onConfirm={handleDelete}
            title={`Delete "${record.title}"?`} description="This record and its notes will be permanently removed." confirmText="Delete" destructive />
        </>
      )}
    </AnimatePresence>
  );
}

function AttachmentTile({ att, onRemove }: { att: Attachment; onRemove: () => void }) {
  const [src, setSrc] = useState<string | undefined>(att.dataUrl);
  useEffect(() => {
    let cancelled = false;
    if (!src && att.hash) getAttachmentDataUrl(att).then((u) => { if (!cancelled) setSrc(u); });
    return () => { cancelled = true; };
  }, [att.id]);
  const isImage = att.mimeType.startsWith("image/");
  return (
    <div className="relative group rounded-lg border border-border bg-muted/40 overflow-hidden aspect-square">
      {isImage && src ? (
        <img src={src} alt={att.name} className="w-full h-full object-cover" />
      ) : (
        <a href={src} download={att.name} className="flex flex-col items-center justify-center w-full h-full text-xs text-muted-foreground p-2 text-center">
          <Paperclip className="w-4 h-4 mb-1" />
          <span className="truncate w-full">{att.name}</span>
        </a>
      )}
      <button onClick={onRemove}
        className="absolute top-1 right-1 p-1 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

function SaveBadge({ status }: { status: "saved" | "saving" | "error" }) {
  const map = {
    saved: { label: "Saved locally", color: "bg-tag-sage" },
    saving: { label: "Saving…", color: "bg-tag-gold animate-pulse" },
    error: { label: "Error saving", color: "bg-destructive" },
  } as const;
  const s = map[status];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("w-1.5 h-1.5 rounded-full", s.color)} />
      <span>{s.label}</span>
    </span>
  );
}
