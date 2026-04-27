import {
  readTextFile,
  writeTextFile,
  readDir,
  mkdir,
  remove,
  exists,
  writeFile,
  readFile,
  rename,
} from "@tauri-apps/plugin-fs";
import { join, appDataDir, normalize as normalizePath } from "@tauri-apps/api/path";
import type { StorageAdapter } from "@/lib/storage/storage-adapter";
import { coerceLegacyContentItem, normalizeItemLifecycle, type ContentItem } from "@/models/item";
import type { AppSettings } from "@/models/settings";
import { AppSettingsSchema, DEFAULT_SETTINGS } from "@/models/settings";
import {
  assertPathInsideDirectory,
  assertSafeStoredFileId,
  validateStoredFileId,
} from "@/lib/files/file-id";

const VAULT_FILE = "vault.json";
const VAULT_TMP_FILE = "vault.json.tmp";
const VAULT_BACKUP_FILE = "vault.json.bak";
const FILES_DIR = "files";
const DEFAULT_BINARY_MIME = "application/octet-stream";
const EXTENSION_MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  json: "application/json",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

interface FileMetadata {
  type?: string;
}

type FileMetadataMap = Record<string, FileMetadata>;
type VaultDiskData = {
  items?: unknown;
  settings?: unknown;
  fileMetadata?: unknown;
  revision?: unknown;
};

type ParsedVaultFile = {
  content: string;
  data: VaultDiskData;
};

function inferMimeTypeFromName(name: string): string | null {
  const ext = name.split(".").pop()?.trim().toLowerCase();
  if (!ext) {
    return null;
  }

  return EXTENSION_MIME_TYPES[ext] ?? null;
}

/**
 * Tauri-native File System Adapter.
 * Maps the storage interface to a local directory on the user's machine.
 */
export class TauriFileSystemAdapter implements StorageAdapter {
  private vaultPath: string | null = null;
  private items: ContentItem[] = [];
  private settings: AppSettings = DEFAULT_SETTINGS;
  private fileMetadata: FileMetadataMap = {};
  private revision = 0;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(vaultPath?: string) {
    if (vaultPath) this.vaultPath = vaultPath;
  }

  setVaultPath(path: string) {
    this.vaultPath = path;
  }

  private async ensureVaultPath(): Promise<string> {
    if (!this.vaultPath) {
      // Fallback to app data dir if no path provided
      this.vaultPath = await join(await appDataDir(), "default-vault");
    }
    if (!(await exists(this.vaultPath))) {
      await mkdir(this.vaultPath, { recursive: true });
    }
    const filesPath = await join(this.vaultPath, FILES_DIR);
    if (!(await exists(filesPath))) {
      await mkdir(filesPath, { recursive: true });
    }
    return this.vaultPath;
  }

  async init(): Promise<void> {
    const path = await this.ensureVaultPath();
    const vaultFile = await join(path, VAULT_FILE);
    const backupFile = await join(path, VAULT_BACKUP_FILE);

    await this.cleanupOrphanTempFile(path);

    if (await exists(vaultFile)) {
      const parsed = await this.tryReadVaultFile(vaultFile);

      if (parsed) {
        this.applyVaultData(parsed.data);
        return;
      }

      const backup = (await exists(backupFile)) ? await this.tryReadVaultFile(backupFile) : null;
      if (backup) {
        console.warn("Vault file was unreadable. Restoring the last known good backup.");
        this.applyVaultData(backup.data);
        await this.writeVaultSnapshot({ checkRevision: false });
        return;
      }

      console.error("Vault file was unreadable and no valid backup was available.");
      const content = await readTextFile(vaultFile);
      const corruptFile = await join(path, `vault.corrupt-${Date.now()}.json`);
      await writeTextFile(corruptFile, content);
      this.items = [];
      this.settings = DEFAULT_SETTINGS;
      this.fileMetadata = {};
      this.revision = 0;
      await this.writeVaultSnapshot({ checkRevision: false });
    } else {
      this.items = [];
      this.settings = DEFAULT_SETTINGS;
      this.fileMetadata = {};
      this.revision = 0;
      await this.writeVaultSnapshot({ checkRevision: false });
    }
  }

  private async tryReadVaultFile(path: string): Promise<ParsedVaultFile | null> {
    try {
      const content = await readTextFile(path);
      const data = JSON.parse(content) as VaultDiskData;
      return { content, data };
    } catch {
      return null;
    }
  }

  private applyVaultData(data: VaultDiskData): void {
    this.items = this.parseItems(data.items);
    this.fileMetadata = this.parseFileMetadata(data.fileMetadata);

    const settingsResult = AppSettingsSchema.safeParse(data.settings);
    this.settings = settingsResult.success ? settingsResult.data : DEFAULT_SETTINGS;
    this.revision = typeof data.revision === "number" && data.revision >= 0 ? data.revision : 0;
  }

  private parseItems(raw: unknown): ContentItem[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw.flatMap((item) => {
      const repaired = coerceLegacyContentItem(item);
      return repaired ? [normalizeItemLifecycle(repaired)] : [];
    });
  }

  private parseFileMetadata(raw: unknown): FileMetadataMap {
    if (!raw || typeof raw !== "object") {
      return {};
    }

    const entries = Object.entries(raw as Record<string, unknown>);
    const parsed: FileMetadataMap = {};

    for (const [id, value] of entries) {
      if (!validateStoredFileId(id).valid) {
        continue;
      }

      if (typeof value === "string") {
        parsed[id] = {
          type: value,
        };
        continue;
      }

      if (!value || typeof value !== "object") {
        continue;
      }

      const type = (value as { type?: unknown }).type;
      parsed[id] = {
        type: typeof type === "string" ? type : undefined,
      };
    }

    return parsed;
  }

  private getFileMimeType(id: string): string {
    const storedType = this.fileMetadata[id]?.type;
    if (storedType && storedType.trim().length > 0) {
      return storedType;
    }

    const inferredFromItems = this.getItemDerivedMimeType(id);
    if (inferredFromItems) {
      this.fileMetadata[id] = { type: inferredFromItems };
      return inferredFromItems;
    }

    const inferredFromName = inferMimeTypeFromName(id);
    if (inferredFromName) {
      this.fileMetadata[id] = { type: inferredFromName };
      return inferredFromName;
    }

    return DEFAULT_BINARY_MIME;
  }

  private getItemDerivedMimeType(fileId: string): string | null {
    for (const item of this.items) {
      if (!item.metadata || typeof item.metadata !== "object" || Array.isArray(item.metadata)) {
        continue;
      }

      const metadata = item.metadata as Record<string, unknown>;
      if (metadata.fileId !== fileId) {
        continue;
      }

      const originalFormat =
        typeof metadata.originalFormat === "string" ? metadata.originalFormat : undefined;
      if (originalFormat) {
        const inferredFromFormat = inferMimeTypeFromName(`placeholder.${originalFormat}`);
        if (inferredFromFormat) {
          return inferredFromFormat;
        }
      }

      const originalFilename =
        typeof metadata.originalFilename === "string"
          ? metadata.originalFilename
          : item.source?.originalFilename;
      if (originalFilename) {
        const inferredFromFilename = inferMimeTypeFromName(originalFilename);
        if (inferredFromFilename) {
          return inferredFromFilename;
        }
      }
    }

    return null;
  }

  private async getFilesPath(): Promise<string> {
    const path = await this.ensureVaultPath();
    return join(path, FILES_DIR);
  }

  private async getSafeFilePath(id: string): Promise<string> {
    assertSafeStoredFileId(id);

    const filesPath = await normalizePath(await this.getFilesPath());
    const filePath = await normalizePath(await join(filesPath, id));
    assertPathInsideDirectory(filePath, filesPath);
    return filePath;
  }

  private async cleanupOrphanTempFile(path: string): Promise<void> {
    const vaultFile = await join(path, VAULT_FILE);
    const tmpFile = await join(path, VAULT_TMP_FILE);
    if (!(await exists(tmpFile))) {
      return;
    }

    const tmp = await this.tryReadVaultFile(tmpFile);
    if (!(await exists(vaultFile)) && tmp) {
      await rename(tmpFile, vaultFile);
      return;
    }

    await remove(tmpFile);
  }

  private async saveVault(): Promise<void> {
    const nextSave = this.writeChain.then(() => this.writeVaultSnapshot());
    this.writeChain = nextSave.catch(() => {});
    return nextSave;
  }

  private async writeVaultSnapshot(options: { checkRevision?: boolean } = {}): Promise<void> {
    const path = await this.ensureVaultPath();
    const vaultFile = await join(path, VAULT_FILE);
    const tmpFile = await join(path, VAULT_TMP_FILE);
    const backupFile = await join(path, VAULT_BACKUP_FILE);
    const nextRevision = this.revision + 1;
    const data = {
      items: this.items,
      settings: this.settings,
      fileMetadata: this.fileMetadata,
      revision: nextRevision,
      updatedAt: new Date().toISOString(),
    };
    const serialized = JSON.stringify(data, null, 2);

    JSON.parse(serialized);

    let currentContent: string | null = null;
    if (await exists(vaultFile)) {
      currentContent = await readTextFile(vaultFile);
      if (options.checkRevision !== false) {
        const currentData = JSON.parse(currentContent) as VaultDiskData;
        const currentRevision =
          typeof currentData.revision === "number" && currentData.revision >= 0
            ? currentData.revision
            : 0;

        if (currentRevision !== this.revision) {
          throw new Error(
            "Vault changed on disk since this window loaded it. Reload before saving to avoid overwriting newer data.",
          );
        }
      } else if (!(await this.tryReadVaultFile(vaultFile))) {
        currentContent = null;
      }
    }

    try {
      await writeTextFile(tmpFile, serialized);

      if (currentContent !== null) {
        await writeTextFile(backupFile, currentContent);
      }

      await rename(tmpFile, vaultFile);
      this.revision = nextRevision;
    } catch (error) {
      if (await exists(tmpFile)) {
        await remove(tmpFile);
      }
      throw error;
    }
  }

  async getAllItems(): Promise<ContentItem[]> {
    return [...this.items];
  }

  async getItem(id: string): Promise<ContentItem | undefined> {
    return this.items.find((i) => i.id === id);
  }

  async putItem(item: ContentItem): Promise<void> {
    const normalizedItem = normalizeItemLifecycle(item);
    const index = this.items.findIndex((i) => i.id === normalizedItem.id);
    if (index >= 0) {
      this.items[index] = normalizedItem;
    } else {
      this.items.push(normalizedItem);
    }
    await this.saveVault();
  }

  async putItems(items: ContentItem[]): Promise<void> {
    for (const item of items) {
      const normalizedItem = normalizeItemLifecycle(item);
      const index = this.items.findIndex((i) => i.id === normalizedItem.id);
      if (index >= 0) {
        this.items[index] = normalizedItem;
      } else {
        this.items.push(normalizedItem);
      }
    }
    await this.saveVault();
  }

  async deleteItem(id: string): Promise<void> {
    this.items = this.items.filter((i) => i.id !== id);
    await this.saveVault();
  }

  async clearItems(): Promise<void> {
    this.items = [];
    await this.saveVault();
  }

  async getSettings(): Promise<AppSettings | undefined> {
    return this.settings;
  }

  async putSettings(settings: AppSettings): Promise<void> {
    this.settings = settings;
    await this.saveVault();
  }

  async putFile(id: string, blob: Blob): Promise<void> {
    const filePath = await this.getSafeFilePath(id);
    const arrayBuffer = await blob.arrayBuffer();
    await writeFile(filePath, new Uint8Array(arrayBuffer));
    this.fileMetadata[id] = {
      type: blob.type || inferMimeTypeFromName(id) || DEFAULT_BINARY_MIME,
    };
    await this.saveVault();
  }

  async getFile(id: string): Promise<Blob | undefined> {
    const filePath = await this.getSafeFilePath(id);
    if (await exists(filePath)) {
      const data = await readFile(filePath);
      return new Blob([data], { type: this.getFileMimeType(id) });
    }
    return undefined;
  }

  async getAllFiles(): Promise<{ id: string; blob: Blob }[]> {
    const filesPath = await this.getFilesPath();
    const entries = await readDir(filesPath);
    const results: { id: string; blob: Blob }[] = [];

    for (const entry of entries) {
      if (entry.isFile && entry.name) {
        const validation = validateStoredFileId(entry.name);
        if (!validation.valid) {
          console.warn(`Skipping unsafe stored file "${entry.name}": ${validation.reason}`);
          continue;
        }

        const data = await readFile(await this.getSafeFilePath(entry.name));
        results.push({
          id: entry.name,
          blob: new Blob([data], { type: this.getFileMimeType(entry.name) }),
        });
      }
    }
    return results;
  }

  async deleteFile(id: string): Promise<void> {
    const filePath = await this.getSafeFilePath(id);
    let changed = false;

    if (await exists(filePath)) {
      await remove(filePath);
      changed = true;
    }

    if (id in this.fileMetadata) {
      delete this.fileMetadata[id];
      changed = true;
    }

    if (changed) {
      await this.saveVault();
    }
  }

  async clearAll(): Promise<void> {
    const path = await this.ensureVaultPath();
    this.items = [];
    this.settings = DEFAULT_SETTINGS;
    this.fileMetadata = {};
    await this.saveVault();

    const filesPath = await join(path, FILES_DIR);
    if (await exists(filesPath)) {
      await remove(filesPath, { recursive: true });
      await mkdir(filesPath);
    }
  }
}
