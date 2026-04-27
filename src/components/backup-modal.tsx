import { useRef, useState } from "react";
import { Modal } from "./modal";
import { exportAllJSON, importAllJSON, getSettings } from "@/lib/storage";
import { useToast } from "./toast";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/db";
import { Download, Upload, HardDrive } from "lucide-react";
import { formatRelative } from "@/lib/utils";

export function BackupModal({ open, onClose, onOpenStorage }: { open: boolean; onClose: () => void; onOpenStorage?: () => void }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const settings = useLiveQuery(() => getSettings(), [], null);
  const counts = useLiveQuery(async () => ({
    spaces: await db.workspaces.count(),
    records: await db.records.count(),
    attachments: await db.attachments.count(),
  }), []);

  const handleExport = async () => {
    try {
      setBusy(true);
      const data = await exportAllJSON();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vault-atelier-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Backup exported", description: "Saved to your downloads folder.", variant: "success" });
    } catch (e) {
      toast({ title: "Export failed", description: (e as Error).message, variant: "error" });
    } finally { setBusy(false); }
  };

  const handleImport = async (file: File) => {
    try {
      setBusy(true);
      const text = await file.text();
      const data = JSON.parse(text);
      await importAllJSON(data);
      toast({ title: "Backup imported", description: "Your archive has been restored.", variant: "success" });
      setTimeout(() => window.location.reload(), 600);
    } catch (e) {
      toast({ title: "Import failed", description: "This backup could not be imported. Please check the file and try again.", variant: "error" });
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Backup & Restore" maxWidth="max-w-lg">
      <div className="space-y-5">
        <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
          <div className="grid grid-cols-3 gap-3 mb-2">
            <Stat label="Spaces" value={counts?.spaces ?? 0} />
            <Stat label="Records" value={counts?.records ?? 0} />
            <Stat label="Files" value={counts?.attachments ?? 0} />
          </div>
          {settings?.lastBackupAt && (
            <p className="text-xs text-muted-foreground mt-2">Last backup: {formatRelative(settings.lastBackupAt)}</p>
          )}
        </div>

        <div className="space-y-2">
          <button
            onClick={handleExport}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> Export full backup (JSON)
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md border border-border hover:bg-muted text-sm disabled:opacity-50"
          >
            <Upload className="w-4 h-4" /> Import backup (JSON)
          </button>
          <input
            ref={fileRef} type="file" accept="application/json" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ""; }}
          />
        </div>
        {onOpenStorage && (
          <button onClick={onOpenStorage}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-md border border-border hover:bg-muted text-sm">
            <span className="inline-flex items-center gap-2"><HardDrive className="w-4 h-4" /> Attachment manager</span>
            <span className="text-xs text-muted-foreground">Dedupe & cleanup</span>
          </button>
        )}
        <p className="text-xs text-muted-foreground leading-relaxed">
          Importing will replace all current data with the backup contents. Export first if you want to keep what you have.
        </p>
      </div>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-2xl font-display text-primary">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
