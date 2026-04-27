import JSZip from "jszip";
import type { StorageAdapter } from "@/lib/storage/storage-adapter";
import { VAULT_FILE_NAMES, type VaultBundle } from "@/models/vault";
import { SCHEMA_VERSION } from "@/models/item";
import { nowIso } from "@/lib/utils/dates";
import { DEFAULT_SETTINGS } from "@/models/settings";
import { buildAIPackZip } from "./ai-pack-exporter";
import { saveBlob } from "@/lib/platform/file-save";

/**
 * Exports the entire vault as a ZIP file.
 * This includes items, settings, and all binary attachments.
 */
export async function exportVault(storage: StorageAdapter, vaultName: string): Promise<Blob> {
  const zip = new JSZip();

  // 1. Fetch data
  const items = await storage.getAllItems();
  const settings = (await storage.getSettings()) ?? DEFAULT_SETTINGS;
  const files = await storage.getAllFiles();

  // 2. Build manifest
  const bundle: VaultBundle = {
    manifest: {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: nowIso(),
      appName: "Scholar's Haven",
      itemCount: items.length,
      vaultName: vaultName,
      vaultId: crypto.randomUUID(), // New ID for each export to track lineage if needed
      fileCount: files.length,
    },
    settings,
    items,
    files: files.map((f) => ({
      id: f.id,
      type: f.blob.type,
      size: f.blob.size,
    })),
  };

  // 3. Add to ZIP
  zip.file(VAULT_FILE_NAMES.MANIFEST, JSON.stringify(bundle, null, 2));

  const filesFolder = zip.folder(VAULT_FILE_NAMES.FILES_DIR);
  if (!filesFolder) throw new Error("Could not create files folder in ZIP");

  for (const f of files) {
    filesFolder.file(f.id, await f.blob.arrayBuffer());
  }

  // 4. Generate
  return zip.generateAsync({ type: "blob" });
}

/**
 * Triggers a browser download of the vault.
 */
export async function downloadVault(
  storage: StorageAdapter,
  vaultName = "My Scholar Vault",
): Promise<boolean> {
  const blob = await exportVault(storage, vaultName);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `${vaultName.toLowerCase().replace(/\s+/g, "-")}-${timestamp}.svault`;

  return saveBlob(blob, {
    suggestedName: filename,
    filters: [{ name: "Scholar's Haven vault", extensions: ["svault"] }],
  });
}

/**
 * AI-Ready Export: Zip of human-readable JSON files.
 */
export async function exportAiPack(storage: StorageAdapter): Promise<Blob> {
  const items = await storage.getAllItems();
  return buildAIPackZip(items);
}

export async function downloadAiPack(
  storage: StorageAdapter,
  vaultName = "Scholar-AI-Pack",
): Promise<boolean> {
  const blob = await exportAiPack(storage);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `${vaultName.toLowerCase().replace(/\s+/g, "-")}-${timestamp}.zip`;

  return saveBlob(blob, {
    suggestedName: filename,
    filters: [{ name: "ZIP archive", extensions: ["zip"] }],
  });
}
