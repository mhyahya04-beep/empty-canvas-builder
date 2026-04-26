import { useState, type ReactNode } from "react";
import { useEffect } from "react";
import { Sidebar } from "./sidebar";
import { ToastProvider } from "./ui/toast";
import { SettingsModal } from "./settings-modal";
import { BackupModal } from "./backup-modal";
import { StorageManagerModal } from "./storage-manager-modal";
import { useTheme } from "@/lib/use-theme";
import { useUndoRedoHotkeys, useHistoryState } from "@/lib/history";
import { history } from "@/lib/history";
import { Undo2, Redo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { startUrgentIndexer } from "@/lib/urgent";

export function AppShell({ children }: { children: ReactNode }) {
  useTheme();
  useEffect(() => {
    const stop = startUrgentIndexer();
    return () => stop && stop();
  }, []);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [storageOpen, setStorageOpen] = useState(false);

  return (
    <ToastProvider>
      <ShellInner
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenBackup={() => setBackupOpen(true)}
        onOpenStorage={() => setStorageOpen(true)}
      >
        {children}
      </ShellInner>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <BackupModal open={backupOpen} onClose={() => setBackupOpen(false)} onOpenStorage={() => { setBackupOpen(false); setStorageOpen(true); }} />
      <StorageManagerModal open={storageOpen} onClose={() => setStorageOpen(false)} />
    </ToastProvider>
  );
}

function ShellInner({ children, onOpenSettings, onOpenBackup, onOpenStorage, }: { children: ReactNode; onOpenSettings: () => void; onOpenBackup: () => void; onOpenStorage: () => void; }) {
  useUndoRedoHotkeys();
  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      <Sidebar onOpenSettings={onOpenSettings} onOpenBackup={onOpenBackup} onOpenStorage={onOpenStorage} />
      <main className="flex-1 min-w-0 overflow-hidden flex flex-col relative">
        {children}
        <UndoRedoFloating />
      </main>
    </div>
  );
}

function UndoRedoFloating() {
  const { canUndo, canRedo } = useHistoryState();
  // const { toast } = useToast();
  if (!canUndo && !canRedo) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 rounded-full border border-border bg-card/95 backdrop-blur shadow-lg px-1.5 py-1">
      <button
        onClick={async () => { const l = await history.undo(); /* if (l) toast({ title: "Undid: " + l }); */ }}
        disabled={!canUndo}
        title="Undo (Ctrl/Cmd+Z)"
        className={cn("p-1.5 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors", !canUndo && "opacity-40 cursor-not-allowed")}
      >
        <Undo2 className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={async () => { const l = await history.redo(); /* if (l) toast({ title: "Redid: " + l }); */ }}
        disabled={!canRedo}
        title="Redo (Ctrl/Cmd+Shift+Z)"
        className={cn("p-1.5 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors", !canRedo && "opacity-40 cursor-not-allowed")}
      >
        <Redo2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
