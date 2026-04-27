import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { ensureSeed, deleteSpace, duplicateSpace, exportSpaceCSV } from "@/lib/storage";
import { AppShell } from "@/components/app-shell";
import { CreateSpaceModal } from "@/components/create-space-modal";
import { Confirm, useDropdown } from "@/components/modal";
import { useToast } from "@/components/toast";
import { TEMPLATES } from "@/lib/templates";
import { motion } from "framer-motion";
import { Plus, Search, MoreHorizontal, Star, Copy, Trash2, FileDown, Database } from "lucide-react";
import { cn, formatRelative } from "@/lib/utils";
import type { Space } from "@/lib/types";

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
  useEffect(() => { ensureSeed().finally(() => setSeeded(true)); }, []);
  const spaces = useLiveQuery(() => db.spaces.orderBy("updatedAt").reverse().toArray(), []) ?? [];
  const allRecords = useLiveQuery(() => db.records.orderBy("updatedAt").reverse().limit(8).toArray(), []) ?? [];
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return spaces.filter((s) => !s.archived);
    return spaces.filter((s) => !s.archived && (s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q)));
  }, [spaces, query]);

  const matchedRecords = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || allRecords.length === 0) return [];
    return allRecords.filter((r) => r.title.toLowerCase().includes(q)).slice(0, 6);
  }, [allRecords, query]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-8 py-10">
        <header className="mb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-primary/80 mb-2">Atelier</p>
          <h1 className="text-4xl md:text-5xl font-display font-semibold tracking-tight mb-3">Welcome back to your vault.</h1>
          <p className="text-muted-foreground max-w-2xl">A quiet place to keep your databases, documents, and obsessions — all stored privately on this device.</p>
        </header>

        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search spaces and records…"
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/70"
            />
          </div>
          <button onClick={() => setCreateOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 shadow-sm">
            <Plus className="w-4 h-4" /> New Space
          </button>
        </div>

        {query && matchedRecords.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Matching records</h2>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {matchedRecords.map((r) => {
                const sp = spaces.find((s) => s.id === r.spaceId);
                return (
                  <Link key={r.id} to="/space/$spaceId" params={{ spaceId: r.spaceId }} search={{ record: r.id } as never}
                    className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0 hover:bg-muted/50">
                    <div>
                      <div className="text-sm">{r.title}</div>
                      <div className="text-xs text-muted-foreground">{sp?.icon} {sp?.name}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">{formatRelative(r.updatedAt)}</div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-semibold">Your Spaces</h2>
            <span className="text-xs text-muted-foreground">{filtered.length} {filtered.length === 1 ? "space" : "spaces"}</span>
          </div>
          {seeded && filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center">
              <Database className="w-8 h-8 text-muted-foreground mx-auto mb-4" />
              <p className="font-display text-lg mb-2">Your archive is empty.</p>
              <p className="text-sm text-muted-foreground mb-5">Create your first space and start building your private universe.</p>
              <button onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
                <Plus className="w-4 h-4" /> Create Space
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((s, i) => (
                <SpaceCard key={s.id} space={s} index={i} />
              ))}
            </div>
          )}
        </section>

        {allRecords.length > 0 && (
          <section className="mb-12">
            <h2 className="text-lg font-display font-semibold mb-4">Recent Records</h2>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {allRecords.slice(0, 6).map((r) => {
                const sp = spaces.find((s) => s.id === r.spaceId);
                return (
                  <Link key={r.id} to="/space/$spaceId" params={{ spaceId: r.spaceId }} search={{ record: r.id } as never}
                    className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0 hover:bg-muted/40">
                    <div className="min-w-0">
                      <div className="text-sm truncate">{r.title || "Untitled"}</div>
                      <div className="text-xs text-muted-foreground truncate">{sp?.icon} {sp?.name}</div>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0 ml-4">{formatRelative(r.updatedAt)}</div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <section className="mb-16">
          <h2 className="text-lg font-display font-semibold mb-1">Template Gallery</h2>
          <p className="text-sm text-muted-foreground mb-4">Curated starting points for whatever you're collecting.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {TEMPLATES.slice(0, 8).map((t) => (
              <TemplateCard key={t.key} icon={t.icon} name={t.name} description={t.description} onClick={() => setCreateOpen(true)} />
            ))}
          </div>
        </section>
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
  const recordCount = useLiveQuery(() => db.records.where({ spaceId: space.id }).count(), [space.id]) ?? 0;
  const fields = useLiveQuery(() => db.fields.where({ spaceId: space.id }).toArray(), [space.id]) ?? [];
  const tagsField = fields.find((f) => f.options && f.options.length > 0);
  const previewTags = tagsField?.options?.slice(0, 3) ?? [];
  const { open, setOpen, ref } = useDropdown();
  const { toast } = useToast();
  const [confirmDel, setConfirmDel] = useState(false);

  const toggleFav = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    await db.spaces.update(space.id, { favorite: !space.favorite });
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25, ease: "easeOut" }}
    >
      <Link to="/space/$spaceId" params={{ spaceId: space.id }} search={{}}
        className="group block relative p-5 rounded-2xl border border-border bg-card hover:border-primary/50 transition-all hover:-translate-y-0.5 hover:shadow-xl">
        <div className="flex items-start justify-between mb-3">
          <div className="text-3xl">{space.icon ?? "📁"}</div>
          <div className="flex items-center gap-1">
            <button onClick={toggleFav} className="p-1.5 rounded-md hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity">
              <Star className={cn("w-4 h-4", space.favorite ? "fill-primary text-primary" : "text-muted-foreground")} />
            </button>
            <div ref={ref} className="relative" onClick={(e) => e.preventDefault()}>
              <button onClick={(e) => { e.preventDefault(); setOpen(!open); }} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground">
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {open && (
                <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-border bg-popover shadow-xl z-20 py-1">
                  <DropItem icon={<Copy className="w-3.5 h-3.5" />} onClick={handleDuplicate}>Duplicate</DropItem>
                  <DropItem icon={<FileDown className="w-3.5 h-3.5" />} onClick={handleExportCSV}>Export CSV</DropItem>
                  <DropItem icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => { setOpen(false); setConfirmDel(true); }} destructive>Delete</DropItem>
                </div>
              )}
            </div>
          </div>
        </div>
        <h3 className="font-display text-lg font-semibold mb-1">{space.name}</h3>
        {space.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-3 min-h-[2rem]">{space.description}</p>}
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
          <span>{recordCount} {recordCount === 1 ? "record" : "records"}</span>
          <span>{formatRelative(space.updatedAt)}</span>
        </div>
        {previewTags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {previewTags.map((opt) => (
              <span key={opt.id} className={cn("text-[10px] px-2 py-0.5 rounded-full border",
                `bg-tag-${opt.color}/15 text-tag-${opt.color} border-tag-${opt.color}/30`)}>{opt.label}</span>
            ))}
          </div>
        )}
      </Link>
      <Confirm open={confirmDel} onClose={() => setConfirmDel(false)} onConfirm={handleDelete}
        title={`Delete "${space.name}"?`} description="All records, fields, and notes in this space will be permanently removed." confirmText="Delete" destructive />
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
