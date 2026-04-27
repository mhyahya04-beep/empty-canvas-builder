import { useNavigate } from "@tanstack/react-router";
import { Search, Download, Upload, Menu } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { useItemsStore } from "@/stores/items-store";
import { jsonImporter } from "@/lib/importers/json-importer";
import { getErrorMessage } from "@/lib/utils/errors";
import { getActiveStorage } from "@/lib/storage/active-storage";
import { useRef } from "react";
import { toast } from "sonner";

export function TopBar() {
  const navigate = useNavigate();
  const setQuery = useUIStore((s) => s.setSearchQuery);
  const query = useUIStore((s) => s.searchQuery);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const mergeImported = useItemsStore((s) => s.mergeImported);
  const fileRef = useRef<HTMLInputElement>(null);

  const onExport = async () => {
    try {
      const storage = await getActiveStorage();
      const { downloadVault } = await import("@/lib/exporters/vault-exporter");
      const saved = await downloadVault(storage, "Scholar Vault");
      if (saved) {
        toast.success("Full vault backup exported (.svault)");
      } else {
        toast.info("Vault export cancelled.");
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to export vault"));
    }
  };

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const promise = (async () => {
      const lowerName = file.name.toLowerCase();

      if (lowerName.endsWith(".svault")) {
        if (
          !confirm(
            "Importing a .svault backup will replace your current vault, including notes, settings, and stored files. Export a backup first if you may need the current data. Continue?",
          )
        ) {
          return { count: 0, warnings: [], source: file.name, skipped: true };
        }

        const storage = await getActiveStorage();
        const { importVault } = await import("@/lib/importers/vault-importer");
        const result = await importVault(storage, file);
        setTimeout(() => location.reload(), 500);
        return {
          count: result.itemCount,
          warnings: [],
          source: `${file.name} (${result.fileCount} files)`,
          skipped: false,
        };
      }

      // JSON bundles are dispatched separately because their importer takes text.
      if (lowerName.endsWith(".json")) {
        const text = await file.text();
        if (!jsonImporter.canHandle(text)) {
          throw new Error("Not a valid Scholar's Haven JSON bundle.");
        }
        const { items: imported, warnings } = await jsonImporter.import(text);
        await mergeImported(imported);
        return { count: imported.length, warnings, source: "JSON bundle", skipped: false };
      }

      const importer = await loadFileImporter(file);
      if (!importer) {
        throw new Error(
          `No importer available for "${file.name}". Supported: .svault, .json, .docx, .pdf`,
        );
      }

      const { items: imported, warnings } = await importer.import(file);
      await mergeImported(imported);
      return { count: imported.length, warnings, source: file.name, skipped: false };
    })();

    toast.promise(promise, {
      loading: "Importing data...",
      success: (data) => {
        if (data.skipped) {
          return "Import cancelled.";
        }
        if (data.warnings.length) {
          return `Imported ${data.count} items from ${data.source} with ${data.warnings.length} warnings.`;
        }
        return `Imported ${data.count} items from ${data.source}.`;
      },
      error: (error) => `Import failed: ${getErrorMessage(error)}`,
    });

    e.target.value = "";
  };

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-border bg-background/60 px-6 backdrop-blur-xl">
      <button
        type="button"
        aria-label="Toggle navigation"
        onClick={toggleSidebar}
        className="rounded-lg p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="relative max-w-xl flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50 transition-colors" />
        <input
          aria-label="Search items"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => navigate({ to: "/search" })}
          placeholder="Search items, tags, or content..."
          className="h-10 w-full rounded-xl border border-border bg-card/50 pl-10 pr-4 text-sm transition-all placeholder:text-muted-foreground/50 focus:border-primary/40 focus:bg-card focus:outline-none focus:ring-4 focus:ring-primary/5"
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground/70 transition hover:bg-accent hover:text-foreground"
        >
          <Upload className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Import Items</span>
        </button>
        <button
          type="button"
          onClick={onExport}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground/70 transition hover:bg-accent hover:text-foreground"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Backup</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".svault,.json,.docx,.pdf,application/json,application/pdf"
          hidden
          onChange={onImport}
        />
      </div>
    </header>
  );
}

async function loadFileImporter(file: File) {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".docx")) {
    const { docxImporter } = await import("@/lib/importers/docx-importer");
    return docxImporter;
  }

  if (lowerName.endsWith(".pdf")) {
    const { pdfImporter } = await import("@/lib/importers/pdf-importer");
    return pdfImporter;
  }

  return null;
}
