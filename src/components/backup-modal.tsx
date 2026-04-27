import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  BookOpen,
  CheckCircle2,
  Database,
  Download,
  HardDrive,
  History,
  Shield,
  Upload,
} from "lucide-react";
import { Modal } from "./modal";
import { useToast } from "./toast";
import { db } from "@/lib/db/db";
import { formatRelative } from "@/lib/utils";
import { getSettings, exportAllJSON, importAllJSON } from "@/lib/storage";
import { importCookbookDocuments, importVaultExportZip, importVaultStructuredSnapshot } from "@/lib/migration/runner";
import type {
  CookbookAttachmentDescriptor,
  CookbookIngredientsDocument,
  CookbookRecipesDocument,
} from "@/lib/migration/cookbook";
import type { MigrationManifest } from "@/lib/types";
import type { VaultStructuredSnapshot } from "@/lib/migration/vault-source";

type CookbookDraft = {
  recipesDocument?: CookbookRecipesDocument;
  recipesFileName?: string;
  ingredientsDocument?: CookbookIngredientsDocument;
  ingredientsFileName?: string;
  attachmentIndex?: Record<string, CookbookAttachmentDescriptor[]>;
  attachmentFileName?: string;
};

async function parseJsonFile<T>(file: File): Promise<T> {
  return JSON.parse(await file.text()) as T;
}

function summarizeManifest(manifest: MigrationManifest): string {
  return `${manifest.counts.records} records, ${manifest.counts.attachments} attachments`;
}

export function BackupModal({
  open,
  onClose,
  onOpenStorage,
}: {
  open: boolean;
  onClose: () => void;
  onOpenStorage?: () => void;
}) {
  const { toast } = useToast();
  const backupRef = useRef<HTMLInputElement>(null);
  const vaultZipRef = useRef<HTMLInputElement>(null);
  const vaultSnapshotRef = useRef<HTMLInputElement>(null);
  const cookbookRecipesRef = useRef<HTMLInputElement>(null);
  const cookbookIngredientsRef = useRef<HTMLInputElement>(null);
  const cookbookAttachmentsRef = useRef<HTMLInputElement>(null);

  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [cookbookDraft, setCookbookDraft] = useState<CookbookDraft>({});

  const settings = useLiveQuery(() => getSettings(), [], null);
  const counts = useLiveQuery(
    async () => ({
      spaces: await db.workspaces.count(),
      records: await db.records.count(),
      attachments: await db.attachments.count(),
      migrations: await db.migrationManifests.count(),
    }),
    [],
  );
  const manifests =
    useLiveQuery(() => db.migrationManifests.orderBy("completedAt").reverse().toArray(), []) ?? [];

  const busy = busyLabel !== null;

  const handleExport = async () => {
    try {
      setBusyLabel("Exporting backup");
      const data = await exportAllJSON();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `unified-life-vault-backup-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast({ title: "Backup exported", description: "Saved the full unified vault archive.", variant: "success" });
    } catch (error) {
      toast({ title: "Export failed", description: (error as Error).message, variant: "error" });
    } finally {
      setBusyLabel(null);
    }
  };

  const handleBackupImport = async (file: File) => {
    try {
      setBusyLabel("Importing backup");
      const data = JSON.parse(await file.text()) as { payload?: Record<string, unknown> };
      await importAllJSON(data);
      toast({ title: "Backup imported", description: "The vault archive replaced the current local data.", variant: "success" });
    } catch {
      toast({
        title: "Backup import failed",
        description: "The selected file is not a valid unified vault backup.",
        variant: "error",
      });
    } finally {
      setBusyLabel(null);
    }
  };

  const handleVaultZipImport = async (file: File) => {
    try {
      setBusyLabel("Importing The Vault ZIP");
      const manifest = await importVaultExportZip(file);
      toast({
        title: "The Vault ZIP imported",
        description: summarizeManifest(manifest),
        variant: "success",
      });
    } catch (error) {
      toast({ title: "Vault ZIP import failed", description: (error as Error).message, variant: "error" });
    } finally {
      setBusyLabel(null);
    }
  };

  const handleVaultSnapshotImport = async (file: File) => {
    try {
      setBusyLabel("Importing Vault snapshot");
      const snapshot = await parseJsonFile<VaultStructuredSnapshot>(file);
      const manifest = await importVaultStructuredSnapshot(snapshot);
      toast({
        title: "The Vault snapshot imported",
        description: summarizeManifest(manifest),
        variant: "success",
      });
    } catch (error) {
      toast({ title: "Vault snapshot import failed", description: (error as Error).message, variant: "error" });
    } finally {
      setBusyLabel(null);
    }
  };

  const handleCookbookRecipesLoad = async (file: File) => {
    try {
      const recipesDocument = await parseJsonFile<CookbookRecipesDocument>(file);
      setCookbookDraft((current) => ({
        ...current,
        recipesDocument,
        recipesFileName: file.name,
      }));
      toast({ title: "Recipes loaded", description: file.name, variant: "success" });
    } catch {
      toast({ title: "Recipes file is invalid", description: "Expected My Cookbook recipes JSON.", variant: "error" });
    }
  };

  const handleCookbookIngredientsLoad = async (file: File) => {
    try {
      const ingredientsDocument = await parseJsonFile<CookbookIngredientsDocument>(file);
      setCookbookDraft((current) => ({
        ...current,
        ingredientsDocument,
        ingredientsFileName: file.name,
      }));
      toast({ title: "Ingredients loaded", description: file.name, variant: "success" });
    } catch {
      toast({
        title: "Ingredients file is invalid",
        description: "Expected My Cookbook ingredients JSON.",
        variant: "error",
      });
    }
  };

  const handleCookbookAttachmentsLoad = async (file: File) => {
    try {
      const attachmentIndex = await parseJsonFile<Record<string, CookbookAttachmentDescriptor[]>>(file);
      setCookbookDraft((current) => ({
        ...current,
        attachmentIndex,
        attachmentFileName: file.name,
      }));
      toast({ title: "Recipe attachments loaded", description: file.name, variant: "success" });
    } catch {
      toast({
        title: "Attachment index is invalid",
        description: "Expected an optional JSON object keyed by recipe id.",
        variant: "error",
      });
    }
  };

  const runCookbookImport = async () => {
    if (!cookbookDraft.recipesDocument || !cookbookDraft.ingredientsDocument) {
      toast({
        title: "Cookbook migration is incomplete",
        description: "Load both recipes.json and ingredients.json before importing.",
        variant: "error",
      });
      return;
    }

    try {
      setBusyLabel("Importing cookbook");
      const manifest = await importCookbookDocuments({
        recipesDocument: cookbookDraft.recipesDocument,
        ingredientsDocument: cookbookDraft.ingredientsDocument,
        attachmentIndex: cookbookDraft.attachmentIndex,
      });
      toast({
        title: "Cookbook imported",
        description: summarizeManifest(manifest),
        variant: "success",
      });
      setCookbookDraft({});
    } catch (error) {
      toast({ title: "Cookbook import failed", description: (error as Error).message, variant: "error" });
    } finally {
      setBusyLabel(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Backup & Migration" maxWidth="max-w-4xl">
      <div className="space-y-6">
        <div className="rounded-2xl border border-border bg-muted/20 p-4 text-sm">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Workspaces" value={counts?.spaces ?? 0} />
            <Stat label="Records" value={counts?.records ?? 0} />
            <Stat label="Files" value={counts?.attachments ?? 0} />
            <Stat label="Migrations" value={counts?.migrations ?? 0} />
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
            {settings?.lastBackupAt && <span>Last backup: {formatRelative(settings.lastBackupAt)}</span>}
            {settings?.lastMigrationRunAt && <span>Last migration: {formatRelative(settings.lastMigrationRunAt)}</span>}
            {busyLabel && <span className="font-medium text-foreground">{busyLabel}...</span>}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-primary" />
              <h3 className="font-medium">Unified Vault Backup</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Export or restore the full local database, attachments, settings, and migration manifests for this unified app.
            </p>
            <div className="space-y-2">
              <button
                onClick={handleExport}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Export full backup
              </button>
              <button
                onClick={() => backupRef.current?.click()}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm hover:bg-muted disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                Import backup
              </button>
              <input
                ref={backupRef}
                type="file"
                accept="application/json"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleBackupImport(file);
                  event.target.value = "";
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Full backup import replaces current local state. Export first if you need a rollback point.
            </p>
          </section>

          <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <h3 className="font-medium">The Vault Migration</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Import verified exports from The Vault. Identity and payment records remain sensitive and safe fields only.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => vaultZipRef.current?.click()}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm hover:bg-muted disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                Import The Vault ZIP export
              </button>
              <button
                onClick={() => vaultSnapshotRef.current?.click()}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm hover:bg-muted disabled:opacity-50"
              >
                <Database className="h-4 w-4" />
                Import Vault snapshot JSON
              </button>
              <input
                ref={vaultZipRef}
                type="file"
                accept=".zip,application/zip"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleVaultZipImport(file);
                  event.target.value = "";
                }}
              />
              <input
                ref={vaultSnapshotRef}
                type="file"
                accept="application/json"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleVaultSnapshotImport(file);
                  event.target.value = "";
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Supported sources: The Vault backup/export ZIP and structured JSON snapshots generated from the source app.
            </p>
          </section>

          <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <h3 className="font-medium">My Cookbook Migration</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Stage the authoritative Google Drive documents, then import recipes, ingredients, and optional attachment mappings.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                onClick={() => cookbookRecipesRef.current?.click()}
                disabled={busy}
                className="rounded-md border border-border px-4 py-2.5 text-sm hover:bg-muted disabled:opacity-50"
              >
                Load recipes.json
              </button>
              <button
                onClick={() => cookbookIngredientsRef.current?.click()}
                disabled={busy}
                className="rounded-md border border-border px-4 py-2.5 text-sm hover:bg-muted disabled:opacity-50"
              >
                Load ingredients.json
              </button>
              <button
                onClick={() => cookbookAttachmentsRef.current?.click()}
                disabled={busy}
                className="rounded-md border border-border px-4 py-2.5 text-sm hover:bg-muted disabled:opacity-50 sm:col-span-2"
              >
                Load optional attachment index
              </button>
            </div>
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">
              <p>Recipes: {cookbookDraft.recipesFileName ?? "Not loaded"}</p>
              <p>Ingredients: {cookbookDraft.ingredientsFileName ?? "Not loaded"}</p>
              <p>Attachments: {cookbookDraft.attachmentFileName ?? "Not loaded"}</p>
            </div>
            <button
              onClick={() => void runCookbookImport()}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <BookOpen className="h-4 w-4" />
              Run cookbook migration
            </button>
            <input
              ref={cookbookRecipesRef}
              type="file"
              accept="application/json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleCookbookRecipesLoad(file);
                event.target.value = "";
              }}
            />
            <input
              ref={cookbookIngredientsRef}
              type="file"
              accept="application/json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleCookbookIngredientsLoad(file);
                event.target.value = "";
              }}
            />
            <input
              ref={cookbookAttachmentsRef}
              type="file"
              accept="application/json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleCookbookAttachmentsLoad(file);
                event.target.value = "";
              }}
            />
          </section>

          <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              <h3 className="font-medium">Migration History</h3>
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
              {manifests.length === 0 && (
                <p className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                  No migrations have been recorded yet.
                </p>
              )}
              {manifests.map((manifest) => (
                <ManifestRow key={manifest.id} manifest={manifest} />
              ))}
            </div>
            {onOpenStorage && (
              <button
                onClick={onOpenStorage}
                className="flex w-full items-center justify-between rounded-md border border-border px-4 py-2.5 text-sm hover:bg-muted"
              >
                <span className="inline-flex items-center gap-2">
                  <HardDrive className="h-4 w-4" />
                  Attachment manager
                </span>
                <span className="text-xs text-muted-foreground">Review storage</span>
              </button>
            )}
          </section>
        </div>
      </div>
    </Modal>
  );
}

function ManifestRow({ manifest }: { manifest: MigrationManifest }) {
  const completedAt = manifest.completedAt ?? manifest.startedAt;
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>{manifest.id}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {manifest.source} • {manifest.status} • {formatRelative(completedAt)}
          </p>
        </div>
        <span className="rounded-full bg-background px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
          {manifest.counts.records} records
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {manifest.counts.attachments} attachments • {manifest.counts.warnings} warnings • {manifest.counts.redactions} redactions
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-2xl font-display text-primary">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
