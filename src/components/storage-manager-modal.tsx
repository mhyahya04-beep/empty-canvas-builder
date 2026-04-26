import React from "react";

export function StorageManagerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
      <div className="bg-card p-6 rounded shadow">
        <h2 className="text-lg font-bold">Storage Manager</h2>
        <div className="mt-4">(Storage manager placeholder)</div>
        <div className="mt-4 text-right">
          <button onClick={onClose} className="btn">Close</button>
        </div>
      </div>
    </div>
  );
}
