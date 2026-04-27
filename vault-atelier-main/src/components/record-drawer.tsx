import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import {
  addAttachment, deleteRecord, getDocument, listAttachments, removeAttachment,
  setDocument, updateRecord, getAttachmentDataUrl,
} from "@/lib/storage";
import type { Attachment } from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";
import { X, Maximize2, Minimize2, Trash2, Paperclip, Image as ImageIcon } from "lucide-react";
import { CellEditor } from "./cell-editor";
import { RichTextEditor } from "./rich-editor";
import { useToast } from "./toast";
import { Confirm } from "./modal";
import { cn, formatDate, formatRelative } from "@/lib/utils";

export function RecordDrawer({ recordId, onClose }: { recordId: string | null; onClose: () => void }) {
  const open = !!recordId;
  const record = useLiveQuery(() => recordId ? db.records.get(recordId) : undefined, [recordId]);
  const fields = useLiveQuery(async () =>
    record ? await db.fields.where({ spaceId: record.spaceId }).sortBy("order") : [],
    [record?.spaceId]
  ) ?? [];
  const attachments = useLiveQuery(() => recordId ? listAttachments(recordId) : Promise.resolve([]), [recordId]) ?? [];
  const [doc, setDoc] = useState<unknown>(null);
  const [docLoaded, setDocLoaded] = useState(false);
  const [title, setTitle] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
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
            <header className="px-6 py-3 border-b border-border flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <SaveBadge status={saveStatus} />
                <span>·</span>
                <span>Updated {formatRelative(record.updatedAt)}</span>
              </div>
              <div className="flex items-center gap-1">
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
                <input
                  value={title} onChange={(e) => setTitle(e.target.value)} onBlur={commitTitle}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  placeholder="Untitled"
                  className="w-full bg-transparent font-display text-3xl md:text-4xl font-semibold tracking-tight focus:outline-none mb-2 placeholder:text-muted-foreground/40"
                />
                <p className="text-xs text-muted-foreground mb-6">Created {formatDate(record.createdAt)}</p>

                {fields.length > 0 && (
                  <section className="mb-8">
                    <table className="w-full">
                      <tbody>
                        {fields.map((f) => (
                          <tr key={f.id} className="align-top">
                            <td className="text-xs text-muted-foreground uppercase tracking-wider py-1.5 pr-4 w-40">{f.name}</td>
                            <td className="py-0.5"><CellEditor field={f} record={record} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                )}

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
