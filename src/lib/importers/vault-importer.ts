import JSZip from "jszip";
import type { StorageAdapter } from "@/lib/storage/storage-adapter";
import { VAULT_FILE_NAMES, VaultBundleSchema, type VaultBundle } from "@/models/vault";
import { validateStoredFileId } from "@/lib/files/file-id";

/**
 * Imports an entire vault from a ZIP (.svault) file.
 * WARNING: This typically overwrites existing local data.
 */
export async function importVault(
  storage: StorageAdapter,
  zipBlob: Blob,
  options: { clearExisting: boolean } = { clearExisting: true },
): Promise<{ itemCount: number; fileCount: number }> {
  const zipBuffer = await zipBlob.arrayBuffer();
  const zip = await JSZip.loadAsync(zipBuffer);

  // 1. Read manifest
  const manifestFile = zip.file(VAULT_FILE_NAMES.MANIFEST);
  if (!manifestFile) {
    throw new Error("Invalid vault file: Missing vault.json");
  }

  const manifestJson = await manifestFile.async("string");
  let rawBundle: unknown;

  try {
    rawBundle = JSON.parse(manifestJson);
  } catch {
    throw new Error("Invalid vault file: vault.json is not valid JSON.");
  }

  // 2. Validate
  const result = VaultBundleSchema.safeParse(rawBundle);
  if (!result.success) {
    throw new Error(
      `Invalid vault format: ${result.error.errors.map((e) => e.message).join(", ")}`,
    );
  }

  const bundle = result.data;
  validateVaultFileManifest(bundle);

  const filesFolder = zip.folder(VAULT_FILE_NAMES.FILES_DIR);
  const fileEntries = await resolveVaultFileEntries(filesFolder, bundle);

  // 3. Clear existing if requested
  if (options.clearExisting) {
    await storage.clearAll();
  }

  // 4. Import items and settings
  await storage.putItems(bundle.items);
  await storage.putSettings(bundle.settings);

  // 5. Import files
  let importedFiles = 0;

  for (const { fileMeta, blob } of fileEntries) {
    await storage.putFile(fileMeta.id, blob);
    importedFiles++;
  }

  return {
    itemCount: bundle.items.length,
    fileCount: importedFiles,
  };
}

function validateVaultFileManifest(bundle: VaultBundle): void {
  if (bundle.manifest.itemCount !== bundle.items.length) {
    throw new Error(
      `Invalid vault manifest: item count is ${bundle.manifest.itemCount}, but ${bundle.items.length} items were provided.`,
    );
  }

  if (bundle.manifest.fileCount !== bundle.files.length) {
    throw new Error(
      `Invalid vault manifest: file count is ${bundle.manifest.fileCount}, but ${bundle.files.length} files were listed.`,
    );
  }

  const seen = new Set<string>();

  for (const fileMeta of bundle.files) {
    const validation = validateStoredFileId(fileMeta.id);
    if (!validation.valid) {
      throw new Error(`Invalid vault file ID "${fileMeta.id}": ${validation.reason}`);
    }

    if (seen.has(fileMeta.id)) {
      throw new Error(`Invalid vault file manifest: duplicate file ID "${fileMeta.id}".`);
    }

    seen.add(fileMeta.id);
  }
}

async function resolveVaultFileEntries(
  filesFolder: JSZip | null,
  bundle: VaultBundle,
): Promise<{ fileMeta: VaultBundle["files"][number]; blob: Blob }[]> {
  if (!filesFolder && bundle.files.length > 0) {
    throw new Error("Invalid vault file: Missing files directory.");
  }

  return Promise.all(
    bundle.files.map(async (fileMeta) => {
      const fileInZip = filesFolder?.file(fileMeta.id) ?? null;
      if (!fileInZip) {
        throw new Error(`Invalid vault file: Missing attachment "${fileMeta.id}".`);
      }

      const rawBlob = await fileInZip.async("blob");
      if (fileMeta.size !== rawBlob.size) {
        throw new Error(
          `Invalid vault file: Attachment "${fileMeta.id}" size mismatch (${rawBlob.size} bytes found, ${fileMeta.size} expected).`,
        );
      }

      return { fileMeta, blob: new Blob([rawBlob], { type: fileMeta.type }) };
    }),
  );
}
