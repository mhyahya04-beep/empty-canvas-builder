import { useState } from "react";
import { Modal } from "./modal";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/db";
import { cleanupOrphanAttachments, getStorageStats } from "@/lib/storage";
import { useToast } from "./toast";
import { Trash2, HardDrive, Sparkles, Image as ImageIcon } from "lucide-react";

export function StorageManagerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const stats = useLiveQuery(() => (open ? getStorageStats() : Promise.resolve(null)), [open]);
  const attachments = useLiveQuery(async () => open ? await db.attachments.toArray() : [], [open]) ?? [];
  const blobs = attachments; // In the basic model, each attachment is its own blob



  const cleanup = async () => {
    try {
      setBusy(true);
      const removed = await cleanupOrphanAttachments();
      toast({
        title: removed > 0 ? `Cleaned up ${removed} unreferenced ${removed === 1 ? "file" : "files"}` : "Nothing to clean",
        variant: "success",
      });
    } catch (e) {
      toast({ title: "Cleanup failed", description: (e as Error).message, variant: "error" });
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Attachment Manager" maxWidth="max-w-2xl">
      <div className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat icon={<ImageIcon className="w-3.5 h-3.5" />} label="Files" value={stats?.attachmentCount ?? 0} />
          <Stat icon={<Sparkles className="w-3.5 h-3.5" />} label="Unique blobs" value={stats?.blobCount ?? 0} />
          <Stat icon={<HardDrive className="w-3.5 h-3.5" />} label="Used" value={fmtBytes(stats?.totalBlobBytes ?? 0)} />
          <Stat icon={<Trash2 className="w-3.5 h-3.5" />} label="Orphaned" value={fmtBytes(stats?.orphanBytes ?? 0)} subtle={!stats?.orphanCount} />
        </div>

        {(stats?.dedupeSavings ?? 0) > 0 && (
          <div className="rounded-lg border border-tag-sage/30 bg-tag-sage/10 px-4 py-2.5 text-sm text-foreground">
            <Sparkles className="w-3.5 h-3.5 inline mr-1.5 text-tag-sage" />
            Dedupe saved <strong>{fmtBytes(stats!.dedupeSavings)}</strong> by sharing identical files across records.
          </div>
        )}

        {stats?.estQuota && (
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>Browser storage</span>
              <span>{fmtBytes(stats.estUsage ?? 0)} of {fmtBytes(stats.estQuota)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary" style={{ width: Math.min(100, ((stats.estUsage ?? 0) / stats.estQuota) * 100) + "%" }} />
            </div>
          </div>
        )}

        <div className="rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Stored files ({blobs.length})</span>
            <button
              onClick={cleanup}
              disabled={busy || !stats?.orphanCount}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] hover:bg-muted text-foreground disabled:opacity-40 disabled:cursor-not-allowed normal-case tracking-normal"
            >
              <Trash2 className="w-3 h-3" /> Clean up orphans
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-border">
            {blobs.length === 0 && (
              <div className="px-4 py-6 text-sm text-muted-foreground text-center italic">No files stored yet.</div>
            )}
            {blobs.map((b) => {
              return (
                <div key={b.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="w-10 h-10 rounded bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                    {b.mimeType.startsWith("image/")
                      ? <img src={b.dataUrl} alt="" className="w-full h-full object-cover" />
                      : <ImageIcon className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate">{b.name ?? "Untitled file"}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {fmtBytes(b.size || b.dataUrl.length)} · {b.mimeType || "unknown"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Identical files added to multiple records share storage automatically. Cleanup removes blobs that are no longer referenced (e.g. after deleting records or attachments).
        </p>
      </div>
    </Modal>
  );
}

function Stat({ icon, label, value, subtle }: { icon: React.ReactNode; label: string; value: number | string; subtle?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{icon}{label}</div>
      <div className={"text-lg font-display " + (subtle ? "text-muted-foreground" : "text-foreground")}>{value}</div>
    </div>
  );
}

function fmtBytes(n: number): string {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0; let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}
