import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { AlertCircle, Copy, Database, FileDown, MoreHorizontal, Plus, Search, Star, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Confirm, useDropdown } from "@/components/modal";
import { CreateSpaceModal } from "@/components/create-space-modal";
import { UrgentList } from "@/components/urgent-list";
import { useToast } from "@/components/toast";
import { db } from "@/lib/db/db";
import { deleteSpace, duplicateSpace, exportSpaceCSV, toggleUrgentWorkspace } from "@/lib/storage";
import { cn, formatRelative } from "@/lib/utils";
import type { Workspace } from "@/lib/types";

export const Route = createFileRoute("/")({
  component: HomeRoute,
});

function HomeRoute() {
  return (
    <AppShell>
      <HomePage />
    </AppShell>
  );
}

function HomePage() {
  const workspaces = useLiveQuery(() => db.workspaces.orderBy("updatedAt").reverse().toArray(), []) ?? [];
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return workspaces.filter((workspace) => {
      if (workspace.archived) return false;
      if (!normalized) return true;
      return workspace.name.toLowerCase().includes(normalized) || workspace.description?.toLowerCase().includes(normalized);
    });
  }, [query, workspaces]);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <div className="mx-auto max-w-6xl px-10 py-16">
        <header className="mb-16">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-px w-8 bg-primary/40" />
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-primary">Unified Vault</p>
          </div>
          <h1 className="mb-4 text-5xl font-display font-semibold tracking-tight text-foreground">Workspace first, page first.</h1>
          <p className="max-w-3xl text-lg leading-relaxed text-muted-foreground">
            Every database row opens into a full editable page with properties, attachments, rich content, and export.
          </p>
        </header>

        <div className="mb-16 flex flex-col gap-4 sm:flex-row">
          <div className="group relative flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search workspaces"
              className="w-full rounded-xl border border-border bg-card/50 py-3.5 pl-12 pr-4 text-sm transition-all placeholder:text-muted-foreground/50 focus:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> New Workspace
          </button>
        </div>

        <section className="mb-20">
          <div className="mb-8 flex items-center justify-between border-b border-border/50 pb-4">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.15em] text-primary">
              <AlertCircle className="h-4 w-4" /> Priority Attention
            </h2>
          </div>
          <UrgentList max={5} />
        </section>

        <section className="mb-20">
          <div className="mb-8 flex items-center justify-between border-b border-border/50 pb-4">
            <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-muted-foreground">Workspaces</h2>
            <span className="rounded bg-sidebar-accent px-2 py-1 font-mono text-[10px] text-muted-foreground">{filtered.length} INDEXED</span>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/50 bg-card/20 p-20 text-center backdrop-blur-sm">
              <Database className="mx-auto mb-6 h-10 w-10 text-muted-foreground/30" />
              <p className="mb-3 font-display text-2xl text-foreground/80">No workspaces match.</p>
              <p className="mx-auto mb-8 max-w-sm text-muted-foreground">Create a workspace or clear the current search.</p>
              <button onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-secondary px-6 py-3 text-sm font-bold text-secondary-foreground transition hover:bg-sidebar-accent">
                <Plus className="h-4 w-4" /> Create Workspace
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((workspace, index) => (
                <WorkspaceCard key={workspace.id} workspace={workspace} index={index} />
              ))}
            </div>
          )}
        </section>
      </div>

      <CreateSpaceModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function WorkspaceCard({ workspace }: { workspace: Workspace; index: number }) {
  const recordCount = useLiveQuery(() => db.records.where({ workspaceId: workspace.id }).count(), [workspace.id]) ?? 0;
  const databaseCount = useLiveQuery(() => db.tablesStore.where({ workspaceId: workspace.id }).count(), [workspace.id]) ?? 0;
  const { open, setOpen, ref } = useDropdown();
  const { toast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggleFavorite = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    await db.workspaces.put({ ...workspace, favorite: !workspace.favorite });
  };

  const handleDuplicate = async () => {
    setOpen(false);
    const copy = await duplicateSpace(workspace.id);
    if (copy) toast({ title: "Workspace duplicated", description: copy.name, variant: "success" });
  };

  const handleDelete = async () => {
    await deleteSpace(workspace.id);
    toast({ title: "Workspace deleted", description: workspace.name, variant: "success" });
  };

  const handleExport = async () => {
    setOpen(false);
    const csv = await exportSpaceCSV(workspace.id);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${workspace.name}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Link
        to="/space/$spaceId"
        params={{ spaceId: workspace.id } as any}
        className="group block rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/5"
      >
        <div className="mb-5 flex items-start justify-between">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sidebar-accent text-3xl shadow-sm transition-transform duration-300 group-hover:scale-110">
            {workspace.icon ?? "📁"}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={toggleFavorite} className="rounded-lg p-2 opacity-0 transition-all duration-200 hover:bg-sidebar-accent group-hover:opacity-100">
              <Star className={cn("h-4 w-4", workspace.favorite ? "fill-primary text-primary" : "text-muted-foreground")} />
            </button>
            <div ref={ref} className="relative" onClick={(event) => event.preventDefault()}>
              <button onClick={(event) => { event.preventDefault(); setOpen(!open); }} className="rounded-lg p-2 text-muted-foreground hover:bg-sidebar-accent">
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {open && (
                <div className="absolute right-0 top-full z-20 mt-2 w-48 overflow-hidden rounded-xl border border-border bg-popover/95 py-1.5 shadow-2xl backdrop-blur-md">
                  <DropItem icon={<AlertCircle className={cn("h-3.5 w-3.5", workspace.urgent && "text-orange-500")} />} onClick={() => toggleUrgentWorkspace(workspace.id)}>
                    {workspace.urgent ? "Unmark Urgent" : "Mark Urgent"}
                  </DropItem>
                  <DropItem icon={<Copy className="h-3.5 w-3.5" />} onClick={handleDuplicate}>Duplicate Workspace</DropItem>
                  <DropItem icon={<FileDown className="h-3.5 w-3.5" />} onClick={handleExport}>Export CSV</DropItem>
                  <div className="my-1 h-px bg-border/50" />
                  <DropItem icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => { setOpen(false); setConfirmDelete(true); }} destructive>
                    Delete Workspace
                  </DropItem>
                </div>
              )}
            </div>
          </div>
        </div>

        <h3 className="mb-2 font-display text-xl font-semibold text-foreground transition-colors group-hover:text-primary">{workspace.name}</h3>
        {workspace.description ? (
          <p className="mb-6 h-10 line-clamp-2 text-xs leading-relaxed text-muted-foreground/80">{workspace.description}</p>
        ) : (
          <div className="mb-6 h-10" />
        )}

        <div className="flex items-center justify-between border-t border-border/40 pt-4">
          <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
            <span>{databaseCount} Databases</span>
            <span>{recordCount} Records</span>
          </div>
          <span className="text-[10px] text-muted-foreground/40">{formatRelative(workspace.updatedAt)}</span>
        </div>
      </Link>

      <Confirm
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title={`Delete "${workspace.name}"?`}
        description="All databases, records, pages, and attachments in this workspace will be removed."
        confirmText="Delete Forever"
        destructive
      />
    </>
  );
}

function DropItem({ children, onClick, icon, destructive }: { children: React.ReactNode; onClick: () => void; icon?: React.ReactNode; destructive?: boolean }) {
  return (
    <button onClick={onClick} className={cn("flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted", destructive && "text-destructive")}>
      {icon}
      {children}
    </button>
  );
}
