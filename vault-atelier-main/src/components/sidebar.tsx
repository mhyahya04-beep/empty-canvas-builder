import { Link, useLocation } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Star, Settings, Database, Download, Home, ChevronLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const SIDEBAR_KEY = "vault.sidebar.collapsed";

export function Sidebar({ onOpenSettings, onOpenBackup, onOpenStorage }: { onOpenSettings: () => void; onOpenBackup: () => void; onOpenStorage?: () => void }) {
  const spaces = useLiveQuery(() => db.spaces.orderBy("updatedAt").reverse().toArray(), []) ?? [];
  const favorites = spaces.filter((s) => s.favorite);
  const recents = spaces.slice(0, 5);
  const location = useLocation();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0"); } catch {}
  }, [collapsed]);

  if (collapsed) {
    return (
      <aside className="w-14 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col items-center py-4 gap-3">
        <button onClick={() => setCollapsed(false)} className="p-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground rotate-180">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <Link to="/" className="p-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"><Home className="w-4 h-4" /></Link>
        <button onClick={onOpenBackup} className="p-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"><Download className="w-4 h-4" /></button>
        <button onClick={onOpenSettings} className="mt-auto p-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"><Settings className="w-4 h-4" /></button>
      </aside>
    );
  }

  return (
    <aside className="w-64 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="px-5 pt-5 pb-4 flex items-start justify-between">
        <div>
          <Link to="/" className="block">
            <h1 className="font-display text-xl text-primary tracking-tight">Vault Atelier</h1>
            <p className="text-[11px] text-muted-foreground italic mt-0.5">Your private local archive</p>
          </Link>
        </div>
        <button onClick={() => setCollapsed(true)} className="p-1 rounded-md hover:bg-sidebar-accent text-muted-foreground">
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-5">
        <div>
          <Link
            to="/"
            className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm hover:bg-sidebar-accent",
              location.pathname === "/" && "bg-sidebar-accent text-sidebar-accent-foreground")}
          >
            <Home className="w-4 h-4" /> Home
          </Link>
        </div>

        {favorites.length > 0 && (
          <Section label="Favorites">
            {favorites.map((s) => (
              <SidebarSpaceLink key={s.id} id={s.id} name={s.name} icon={s.icon} active={location.pathname === `/space/${s.id}`} />
            ))}
          </Section>
        )}

        <Section label="Spaces">
          {spaces.filter((s) => !s.archived).map((s) => (
            <SidebarSpaceLink key={s.id} id={s.id} name={s.name} icon={s.icon} active={location.pathname === `/space/${s.id}`} />
          ))}
          {spaces.length === 0 && (
            <p className="px-2.5 text-xs text-muted-foreground">No spaces yet.</p>
          )}
        </Section>

        {recents.length > 0 && (
          <Section label="Recently Opened">
            {recents.slice(0, 4).map((s) => (
              <SidebarSpaceLink key={"r-" + s.id} id={s.id} name={s.name} icon={s.icon} subtle />
            ))}
          </Section>
        )}
      </nav>

      <div className="border-t border-sidebar-border px-3 py-3 flex flex-col gap-1">
        <button onClick={onOpenBackup} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm hover:bg-sidebar-accent text-sidebar-foreground">
          <Download className="w-4 h-4" /> Backup & Restore
        </button>
        <button onClick={onOpenSettings} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm hover:bg-sidebar-accent text-sidebar-foreground">
          <Settings className="w-4 h-4" /> Settings
        </button>
      </div>
    </aside>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="px-2.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-semibold mb-1.5">{label}</h3>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function SidebarSpaceLink({ id, name, icon, active, subtle }: { id: string; name: string; icon?: string; active?: boolean; subtle?: boolean }) {
  return (
    <Link
      to="/space/$spaceId"
      params={{ spaceId: id }}
      search={{}}
      className={cn(
        "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm hover:bg-sidebar-accent transition-colors truncate",
        active ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-primary -ml-[2px] pl-[10px]"
               : subtle ? "text-muted-foreground" : "text-sidebar-foreground"
      )}
    >
      <span className="w-5 text-center">{icon ?? <Database className="w-3.5 h-3.5 inline" />}</span>
      <span className="truncate">{name}</span>
    </Link>
  );
}

export function FavoriteIcon({ active }: { active: boolean }) {
  return <Star className={cn("w-3.5 h-3.5", active ? "fill-primary text-primary" : "text-muted-foreground")} />;
}
