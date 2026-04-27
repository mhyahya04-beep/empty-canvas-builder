import { Link, useLocation } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { ChevronLeft, Database, Download, Home, Search, Settings, Shield } from "lucide-react";
import { db } from "@/lib/db/db";
import { cn } from "@/lib/utils";

const SIDEBAR_KEY = "vault.sidebar.collapsed";

export function Sidebar({ onOpenSettings, onOpenBackup }: { onOpenSettings: () => void; onOpenBackup: () => void; onOpenStorage?: () => void }) {
  const workspaces = useLiveQuery(() => db.workspaces.orderBy("updatedAt").reverse().toArray(), []) ?? [];
  const favorites = workspaces.filter((workspace) => workspace.favorite);
  const location = useLocation();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
    } catch {
      // ignore persistence failures
    }
  }, [collapsed]);

  if (collapsed) {
    return (
      <aside className="flex w-14 shrink-0 flex-col items-center gap-3 border-r border-sidebar-border bg-sidebar py-4">
        <button onClick={() => setCollapsed(false)} className="rounded-md p-2 text-sidebar-foreground hover:bg-sidebar-accent">
          <ChevronLeft className="h-4 w-4 rotate-180" />
        </button>
        <Link to="/" className="rounded-md p-2 text-sidebar-foreground hover:bg-sidebar-accent"><Home className="h-4 w-4" /></Link>
        <Link to="/search" className="rounded-md p-2 text-sidebar-foreground hover:bg-sidebar-accent"><Search className="h-4 w-4" /></Link>
        <button onClick={onOpenBackup} className="rounded-md p-2 text-sidebar-foreground hover:bg-sidebar-accent"><Download className="h-4 w-4" /></button>
        <button onClick={onOpenSettings} className="mt-auto rounded-md p-2 text-sidebar-foreground hover:bg-sidebar-accent"><Settings className="h-4 w-4" /></button>
      </aside>
    );
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar shadow-2xl">
      <div className="px-6 pb-6 pt-8">
        <Link to="/" className="group block">
          <div className="mb-1 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">V</div>
            <h1 className="font-display text-xl font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">Unified Life Vault</h1>
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">Workspace Database Record Page</p>
        </Link>
      </div>

      <nav className="flex-1 space-y-8 overflow-y-auto px-4 pb-6 custom-scrollbar">
        <Section label="Navigation">
          <NavLink to="/" label="Home" icon={<Home className="h-4 w-4" />} active={location.pathname === "/"} />
          <NavLink to="/search" label="Search" icon={<Search className="h-4 w-4" />} active={location.pathname === "/search"} />
        </Section>

        {favorites.length > 0 && (
          <Section label="Starred Workspaces">
            {favorites.map((workspace) => (
              <WorkspaceLink key={workspace.id} id={workspace.id} name={workspace.name} icon={workspace.icon} active={location.pathname === `/space/${workspace.id}`} />
            ))}
          </Section>
        )}

        <Section label="Workspaces">
          {workspaces.map((workspace) => (
            <WorkspaceLink key={workspace.id} id={workspace.id} name={workspace.name} icon={workspace.icon} active={location.pathname === `/space/${workspace.id}`} />
          ))}
          {workspaces.length === 0 && <p className="px-3 text-xs italic text-muted-foreground/50">No workspaces available yet.</p>}
        </Section>
      </nav>

      <div className="space-y-1 border-t border-sidebar-border bg-black/10 px-4 py-4">
        <button onClick={onOpenBackup} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground">
          <Download className="h-4 w-4" />
          <span className="flex-1 text-left">Backup & Migration</span>
        </button>
        <button onClick={onOpenSettings} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground">
          <Settings className="h-4 w-4" />
          <span className="flex-1 text-left">Vault Settings</span>
        </button>
        <div className="flex items-center gap-3 px-3 pt-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground/60">
          <Shield className="h-3.5 w-3.5" />
          Sensitive records stay masked by default.
        </div>
      </div>
    </aside>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</h3>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function NavLink({ to, label, icon, active }: { to: "/" | "/search"; label: string; icon: React.ReactNode; active: boolean }) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
        active ? "bg-primary/10 font-medium text-primary shadow-sm" : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </Link>
  );
}

function WorkspaceLink({ id, name, icon, active }: { id: string; name: string; icon?: string; active?: boolean }) {
  return (
    <Link
      to="/space/$spaceId"
      params={{ spaceId: id } as any}
      className={cn(
        "flex items-center gap-2 truncate rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-sidebar-accent",
        active ? "-ml-[2px] border-l-2 border-primary bg-sidebar-accent pl-[10px] text-sidebar-accent-foreground" : "text-sidebar-foreground",
      )}
    >
      <span className="w-5 text-center">{icon ?? <Database className="inline h-3.5 w-3.5" />}</span>
      <span className="truncate">{name}</span>
    </Link>
  );
}
