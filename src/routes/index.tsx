import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/db";
import { ensureSeed, deleteSpace, duplicateSpace, exportSpaceCSV, addMockDataToAllWorkspaces, deduplicateWorkspacesAndRecords, toggleUrgentWorkspace } from "@/lib/storage";
import { AppShell } from "@/components/app-shell";
import { CreateSpaceModal } from "@/components/create-space-modal";
import { Confirm, useDropdown } from "@/components/modal";
import { useToast } from "@/components/toast";
import { TEMPLATES } from "@/lib/templates";
import { motion } from "framer-motion";
import { Plus, Search, MoreHorizontal, Star, Copy, Trash2, FileDown, Database, AlertCircle } from "lucide-react";
import { cn, formatRelative } from "@/lib/utils";
import type { Workspace as Space } from "@/lib/types";
import { UrgentList } from "@/components/urgent-list";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vault Atelier — Your private local archive" },
      { name: "description", content: "A premium local-first archive for everything you collect, study, dream, and remember. Notion + Excel + Google Docs in one private vault." },
      { property: "og:title", content: "Vault Atelier — Your private local archive" },
      { property: "og:description", content: "Premium local-first archive. No accounts. No servers. Just your vault." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <AppShell>
      <HomeContent />
    </AppShell>
  );
}

function HomeContent() {
  const [seeded, setSeeded] = useState(false);
  useEffect(() => { 
    ensureSeed().then(() => {
      setSeeded(true);
    }); 
  }, []);
  const spaces = useLiveQuery(() => db.workspaces.orderBy("updatedAt").reverse().toArray(), []) ?? [];
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return spaces.filter((s) => !(s as any).archived);
    return spaces.filter((s) => !(s as any).archived && (s.name.toLowerCase().includes(q) || (s as any).description?.toLowerCase().includes(q)));
  }, [spaces, query]);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="max-w-5xl mx-auto px-10 py-16">
        <header className="mb-16">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-[1px] w-8 bg-primary/40"></div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-primary font-bold">Atelier</p>
          </div>
          <h1 className="text-5xl font-display font-semibold tracking-tight mb-4 text-foreground">Welcome back to your vault.</h1>
          <p className="text-muted-foreground text-lg max-w-2xl leading-relaxed">
            Your private sanctuary for knowledge, data, and digital artifacts. 
            All stored locally, forever yours.
          </p>
        </header>

        <div className="flex flex-col sm:flex-row gap-4 mb-16">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your spaces..."
              className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-card/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all placeholder:text-muted-foreground/50"
            />
          </div>
          <button onClick={() => setCreateOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 shadow-lg shadow-primary/10 transition-all active:scale-[0.98]">
            <Plus className="w-4 h-4" /> New Space
          </button>
        </div>

        <section className="mb-20">
          <div className="flex items-center justify-between mb-8 border-b border-border/50 pb-4">
            <h2 className="text-sm uppercase tracking-[0.15em] text-primary font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Priority Attention
            </h2>
          </div>
          <UrgentList max={5} />
        </section>

        <section className="mb-20">
          <div className="flex items-center justify-between mb-8 border-b border-border/50 pb-4">
            <h2 className="text-sm uppercase tracking-[0.15em] text-muted-foreground font-bold">Your Archive</h2>
            <span className="text-[10px] bg-sidebar-accent px-2 py-1 rounded text-muted-foreground font-mono">{filtered.length} INDEXED</span>
          </div>
          
          {seeded && filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/50 p-20 text-center bg-card/20 backdrop-blur-sm">
              <Database className="w-10 h-10 text-muted-foreground/30 mx-auto mb-6" />
              <p className="font-display text-2xl mb-3 text-foreground/80">The vault is silent.</p>
              <p className="text-muted-foreground mb-8 max-w-sm mx-auto">Begin your collection by creating a new space for your records.</p>
              <button onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-secondary text-secondary-foreground text-sm font-bold hover:bg-sidebar-accent transition-colors">
                <Plus className="w-4 h-4" /> Initialize First Space
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((s, i) => (
                <SpaceCard key={s.id} space={s} index={i} />
              ))}
            </div>
          )}
        </section>

        <footer className="pt-10 border-t border-border/30 text-center">
          <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.2em]">Vault Atelier &copy; 2026 • Local-first Data Integrity</p>
        </footer>
      </div>

      <CreateSpaceModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}



function TemplateCard({ icon, name, description, onClick }: { icon: string; name: string; description: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-left p-4 rounded-xl border border-border bg-card hover:border-primary/50 transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-sm font-medium">{name}</div>
      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{description}</div>
    </button>
  );
}

function SpaceCard({ space, index }: { space: Space; index: number }) {
  const recordCount = useLiveQuery(() => db.records.where({ workspaceId: space.id }).count(), [space.id]) ?? 0;
  const fields = useLiveQuery(() => db.fields.where({ workspaceId: space.id }).toArray(), [space.id]) ?? [];
  const tagsField = fields.find((f) => f.options && f.options.length > 0);
  const previewTags = tagsField?.options?.slice(0, 3) ?? [];
  const { open, setOpen, ref } = useDropdown();
  const { toast } = useToast();
  const [confirmDel, setConfirmDel] = useState(false);

  const toggleFav = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    await db.workspaces.update(space.id, { favorite: !(space as any).favorite } as any);
  };

  const handleDuplicate = async () => {
    setOpen(false);
    const c = await duplicateSpace(space.id);
    if (c) toast({ title: "Space duplicated", description: c.name, variant: "success" });
  };

  const handleDelete = async () => {
    await deleteSpace(space.id);
    toast({ title: "Space deleted", description: space.name, variant: "success" });
  };

  const handleExportCSV = async () => {
    setOpen(false);
    const csv = await exportSpaceCSV(space.id);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${space.name}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV exported", variant: "success" });
  };

  const handleToggleUrgent = async () => {
    setOpen(false);
    await toggleUrgentWorkspace(space.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3, ease: "easeOut" }}
    >
      <Link to="/space/$spaceId" params={{ spaceId: space.id } as any} search={true as any}
        className="group block relative p-6 rounded-2xl border border-border bg-card hover:border-primary/40 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/5">
        <div className="flex items-start justify-between mb-5">
          <div className="w-12 h-12 rounded-xl bg-sidebar-accent flex items-center justify-center text-3xl shadow-sm group-hover:scale-110 transition-transform duration-300">{(space as any).icon ?? "📁"}</div>
          <div className="flex items-center gap-1">
            <button onClick={toggleFav} className="p-2 rounded-lg hover:bg-sidebar-accent opacity-0 group-hover:opacity-100 transition-all duration-200">
              <Star className={cn("w-4 h-4", (space as any).favorite ? "fill-primary text-primary" : "text-muted-foreground")} />
            </button>
            <div ref={ref} className="relative" onClick={(e) => e.preventDefault()}>
              <button onClick={(e) => { e.preventDefault(); setOpen(!open); }} className="p-2 rounded-lg hover:bg-sidebar-accent text-muted-foreground">
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {open && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-border bg-popover/95 backdrop-blur-md shadow-2xl z-20 py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <DropItem icon={<AlertCircle className={cn("w-3.5 h-3.5", (space as any).urgent && "text-orange-500")} />} onClick={handleToggleUrgent}>
                    {(space as any).urgent ? "Unmark Urgent" : "Mark Urgent"}
                  </DropItem>
                  <DropItem icon={<Copy className="w-3.5 h-3.5" />} onClick={handleDuplicate}>Duplicate Space</DropItem>
                  <DropItem icon={<FileDown className="w-3.5 h-3.5" />} onClick={handleExportCSV}>Export as CSV</DropItem>
                  <div className="h-[1px] bg-border/50 my-1"></div>
                  <DropItem icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => { setOpen(false); setConfirmDel(true); }} destructive>Delete Space</DropItem>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <h3 className="font-display text-xl font-semibold mb-2 text-foreground group-hover:text-primary transition-colors">{space.name}</h3>
        {(space as any).description ? (
          <p className="text-xs text-muted-foreground/80 line-clamp-2 mb-6 leading-relaxed h-8">{(space as any).description}</p>
        ) : (
          <div className="h-8 mb-6"></div>
        )}
        
        <div className="flex items-center justify-between pt-4 border-t border-border/40">
          <div className="flex items-center gap-2">
            <Database className="w-3 h-3 text-primary/50" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">{recordCount} Records</span>
          </div>
          <span className="text-[10px] text-muted-foreground/40">{formatRelative(space.updatedAt)}</span>
        </div>

        {previewTags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mt-4">
            {previewTags.map((opt) => (
              <span key={opt.id} className={cn("text-[9px] font-bold uppercase tracking-[0.05em] px-2.5 py-0.5 rounded-full border shadow-sm",
                `bg-tag-${opt.color}/10 text-tag-${opt.color} border-tag-${opt.color}/20`)}>{opt.label}</span>
            ))}
          </div>
        )}
      </Link>
      <Confirm open={confirmDel} onClose={() => setConfirmDel(false)} onConfirm={handleDelete}
        title={`Delete "${space.name}"?`} description="All records, fields, and notes in this space will be permanently removed. This action cannot be undone." confirmText="Delete Forever" destructive />
    </motion.div>
  );
}

function DropItem({ children, onClick, icon, destructive }: { children: React.ReactNode; onClick: () => void; icon?: React.ReactNode; destructive?: boolean }) {
  return (
    <button onClick={onClick}
      className={cn("w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted text-left",
        destructive && "text-destructive")}>{icon}{children}</button>
  );
}
