import React from "react";
import { Link } from "@tanstack/react-router";
import { ThemeToggle } from "./ui/theme-toggle";

export function Sidebar({ onOpenSettings, onOpenBackup, onOpenStorage }: { onOpenSettings?: () => void; onOpenBackup?: () => void; onOpenStorage?: () => void; }) {
  return (
    <aside className="w-64 border-r border-border bg-card p-4 overflow-auto flex flex-col">
      <div className="mb-6 text-lg font-bold">Unified Vault</div>
      <nav className="space-y-2 flex-1">
        <Link to="/" className="block py-1 px-2 rounded hover:bg-muted">Home</Link>
        <Link to="/records" className="block py-1 px-2 rounded hover:bg-muted">Records</Link>
        <Link to="/sync" className="block py-1 px-2 rounded hover:bg-muted">Export & Sync</Link>
        <Link to="/settings" className="block py-1 px-2 rounded hover:bg-muted">Settings</Link>
      </nav>
      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">Theme</div>
        <ThemeToggle />
      </div>
    </aside>
  );
}
