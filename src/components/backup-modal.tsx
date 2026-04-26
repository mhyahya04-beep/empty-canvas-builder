import React from "react";

export function BackupModal({ open, onClose, onOpenStorage }: { open: boolean; onClose: () => void; onOpenStorage?: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
      <div className="bg-card p-6 rounded shadow">
        <h2 className="text-lg font-bold">Backup</h2>
        <div className="mt-4">(Backup placeholder)</div>
        <div className="mt-4 flex justify-between">
          <button onClick={onOpenStorage} className="btn">Open Storage</button>
          <button onClick={onClose} className="btn">Close</button>
        </div>
      </div>
    </div>
  );
}
