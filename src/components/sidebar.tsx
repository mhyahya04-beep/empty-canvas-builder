import { Link, useLocation } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/db";
import { Star, Settings, Database, Download, Home, ChevronLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { LogIn, LogOut, User, Cloud, RefreshCw } from "lucide-react";
import { useToast } from "./toast";

const SIDEBAR_KEY = "vault.sidebar.collapsed";

export function Sidebar({ onOpenSettings, onOpenBackup, onOpenStorage }: { onOpenSettings: () => void; onOpenBackup: () => void; onOpenStorage?: () => void }) {
  const { user, login, logout } = useAuth();
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    /* global google */
    // @ts-ignore
    if (typeof google === 'undefined') return;
    
    // @ts-ignore
    google.accounts.id.initialize({
      client_id: "784925829312-placeholder.apps.googleusercontent.com", 
      callback: (response: any) => {
        const payload = JSON.parse(window.atob(response.credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        login({ name: payload.name, email: payload.email, picture: payload.picture });
      }
    });
  }, [login]);

  const handleLogin = () => {
    // @ts-ignore
    google.accounts.id.prompt();
  };

  const handleSync = async () => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in with Google to sync.", variant: "error" });
      handleLogin();
      return;
    }
    setSyncing(true);
    toast({ title: "Syncing to Google Drive...", description: "Backing up documents and media." });
    try {
      const { googleDriveSync } = await import("@/lib/sync/google-drive-sync");
      googleDriveSync.authorize("dummy-token"); // In real app, pass user token
      await googleDriveSync.pushToDrive();
      toast({ title: "Sync Complete", description: "Your archive is safe in the cloud.", variant: "success" });
    } catch (e) {
      toast({ title: "Sync Failed", description: (e as Error).message, variant: "error" });
    } finally {
      setSyncing(false);
    }
  };

  // Map 'spaces' to 'workspaces' for the merged model
  const spaces = useLiveQuery(() => db.workspaces.orderBy("updatedAt").reverse().toArray(), []) ?? [];
  const favorites = spaces.filter((s) => (s as any).favorite);
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
        {user ? (
          <button onClick={logout} className="p-0.5 rounded-full border border-border hover:opacity-80"><img src={user.picture} className="w-6 h-6 rounded-full" /></button>
        ) : (
          <button onClick={handleLogin} className="p-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"><LogIn className="w-4 h-4" /></button>
        )}
        <button onClick={onOpenSettings} className="mt-auto p-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"><Settings className="w-4 h-4" /></button>
      </aside>
    );
  }

  return (
    <aside className="w-64 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col shadow-2xl z-20">
      <div className="px-6 pt-8 pb-6">
        <Link to="/" className="group block">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-sm bg-primary flex items-center justify-center text-primary-foreground font-display font-bold text-xs shadow-inner">V</div>
            <h1 className="font-display text-xl text-foreground tracking-tight font-semibold group-hover:text-primary transition-colors">Vault Atelier</h1>
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60 font-medium">Local-first Archive</p>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 pb-6 space-y-8 custom-scrollbar">
        <div>
          <Link
            to="/"
            className={cn("flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200",
              location.pathname === "/" ? "bg-primary/10 text-primary font-medium shadow-sm" : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground")}
          >
            <Home className="w-4 h-4" /> Home
          </Link>
        </div>

        {favorites.length > 0 && (
          <Section label="Starred">
            {favorites.map((s) => (
              <SidebarSpaceLink key={s.id} id={s.id} name={s.name} icon={(s as any).icon} active={location.pathname === `/space/${s.id}`} />
            ))}
          </Section>
        )}

        <Section label="Spaces">
          {spaces.filter((s) => !(s as any).archived).map((s) => (
            <SidebarSpaceLink key={s.id} id={s.id} name={s.name} icon={(s as any).icon} active={location.pathname === `/space/${s.id}`} />
          ))}
          {spaces.length === 0 && (
            <p className="px-3 text-xs text-muted-foreground/50 italic">No spaces created yet</p>
          )}
        </Section>

        {recents.length > 0 && (
          <Section label="Recent Items">
            {recents.slice(0, 5).map((s) => (
              <SidebarSpaceLink key={"r-" + s.id} id={s.id} name={s.name} icon={(s as any).icon} subtle active={location.pathname === `/space/${s.id}`} />
            ))}
          </Section>
        )}
      </nav>

      <div className="mt-auto border-t border-sidebar-border bg-black/10 px-4 py-4 space-y-1">
        <button onClick={onOpenBackup} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-all">
          <Download className="w-4 h-4" /> 
          <span className="flex-1 text-left">Backup & Export</span>
        </button>
        <button onClick={onOpenSettings} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-all">
          <Settings className="w-4 h-4" /> 
          <span className="flex-1 text-left">Vault Settings</span>
        </button>
        
        {user && (
          <div className="pt-3 mt-3 border-t border-sidebar-border flex items-center gap-3 px-2">
            <img src={user.picture} className="w-7 h-7 rounded-full border border-primary/20 shadow-sm" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold truncate text-foreground/80">{user.name}</div>
              <button onClick={logout} className="text-[9px] text-muted-foreground hover:text-primary uppercase tracking-wider font-bold">Sign Out</button>
            </div>
          </div>
        )}
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
      params={{ spaceId: id } as any}
      search={true as any}
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
