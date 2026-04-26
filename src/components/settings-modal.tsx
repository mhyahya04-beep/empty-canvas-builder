import React from "react";

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
      <div className="bg-card p-6 rounded shadow">
        <h2 className="text-lg font-bold">Settings</h2>
        <div className="mt-4">(Settings placeholder)</div>
        <div className="mt-4 text-right">
          <button onClick={onClose} className="btn">Close</button>
        </div>
      </div>
    </div>
  );
}
