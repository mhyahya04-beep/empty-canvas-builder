import type { ContentItem, ExportBundle } from "@/models/item";
import { SCHEMA_VERSION } from "@/models/item";
import { nowIso } from "@/lib/utils/dates";

export function buildExportBundle(items: ContentItem[]): ExportBundle {
  return {
    manifest: {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: nowIso(),
      appName: "Scholar's Haven",
      itemCount: items.length,
    },
    items,
  };
}

export function downloadJson(bundle: ExportBundle, filename = "scholar-vault-backup.json"): void {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
