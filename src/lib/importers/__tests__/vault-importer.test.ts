import { describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import { importVault } from "../vault-importer";
import type { StorageAdapter } from "@/lib/storage/storage-adapter";
import type { ContentItem } from "@/models/item";
import type { AppSettings } from "@/models/settings";

function createItem(partial?: Partial<ContentItem>): ContentItem {
  return {
    id: "note-abcdef123456",
    type: "note",
    title: "Imported Note",
    slug: "imported-note",
    subjectId: null,
    parentId: null,
    tags: ["imported"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    status: "imported",
    pinned: false,
    archived: false,
    blocks: [{ id: "block-1", type: "paragraph", text: "hello" }],
    ...partial,
  };
}

function createMockStorage(): StorageAdapter {
  return {
    init: vi.fn(async () => {}),
    getAllItems: vi.fn(async () => []),
    getItem: vi.fn(async () => undefined),
    putItem: vi.fn(async () => {}),
    putItems: vi.fn(async () => {}),
    deleteItem: vi.fn(async () => {}),
    clearItems: vi.fn(async () => {}),
    getSettings: vi.fn(async () => undefined),
    putSettings: vi.fn(async () => {}),
    putFile: vi.fn(async () => {}),
    getFile: vi.fn(async () => undefined),
    getAllFiles: vi.fn(async () => []),
    deleteFile: vi.fn(async () => {}),
    clearAll: vi.fn(async () => {}),
  };
}

async function createVaultBlob({
  items,
  settings,
  files,
}: {
  items: ContentItem[];
  settings: AppSettings;
  files: { id: string; type: string; content: string }[];
}) {
  const zip = new JSZip();
  zip.file(
    "vault.json",
    JSON.stringify({
      manifest: {
        schemaVersion: 1,
        exportedAt: "2026-01-01T00:00:00.000Z",
        appName: "Scholar's Haven",
        itemCount: items.length,
        vaultName: "Mock Import",
        vaultId: "vault-1",
        fileCount: files.length,
      },
      settings,
      items,
      files: files.map(({ id, type, content }) => ({
        id,
        type,
        size: new Blob([content]).size,
      })),
    }),
  );

  const filesFolder = zip.folder("files");
  if (!filesFolder) {
    throw new Error("Could not create mock files folder");
  }

  for (const file of files) {
    filesFolder.file(file.id, file.content);
  }

  return zip.generateAsync({ type: "blob" });
}

describe("vault importer", () => {
  it("imports items, settings, and files from a valid vault bundle", async () => {
    const storage = createMockStorage();
    const item = createItem();
    const settings: AppSettings = {
      theme: "dark",
      storageMode: "local_only",
      recentItemIds: [item.id],
    };
    const blob = await createVaultBlob({
      items: [item],
      settings,
      files: [{ id: "attachment-1.pdf", type: "application/pdf", content: "mock-pdf" }],
    });

    const result = await importVault(storage, blob);

    expect(storage.clearAll).toHaveBeenCalledTimes(1);
    expect(storage.putItems).toHaveBeenCalledWith([item]);
    expect(storage.putSettings).toHaveBeenCalledWith(settings);
    expect(storage.putFile).toHaveBeenCalledTimes(1);

    const [fileId, fileBlob] = vi.mocked(storage.putFile).mock.calls[0];
    expect(fileId).toBe("attachment-1.pdf");
    expect(fileBlob).toBeInstanceOf(Blob);
    expect(fileBlob.type).toBe("application/pdf");
    await expect(fileBlob.text()).resolves.toBe("mock-pdf");
    expect(result).toEqual({ itemCount: 1, fileCount: 1 });
  });

  it("can merge without clearing existing data when requested", async () => {
    const storage = createMockStorage();
    const item = createItem();
    const settings: AppSettings = {
      theme: "light",
      storageMode: "local_only",
      recentItemIds: [],
    };
    const blob = await createVaultBlob({
      items: [item],
      settings,
      files: [],
    });

    const result = await importVault(storage, blob, { clearExisting: false });

    expect(storage.clearAll).not.toHaveBeenCalled();
    expect(storage.putItems).toHaveBeenCalledWith([item]);
    expect(storage.putSettings).toHaveBeenCalledWith(settings);
    expect(result).toEqual({ itemCount: 1, fileCount: 0 });
  });

  it("rejects bundles that are missing the manifest", async () => {
    const storage = createMockStorage();
    const zip = new JSZip();
    const blob = await zip.generateAsync({ type: "blob" });

    await expect(importVault(storage, blob)).rejects.toThrow("Missing vault.json");
  });

  it("rejects bundles with malformed vault.json before mutating storage", async () => {
    const storage = createMockStorage();
    const zip = new JSZip();
    zip.file("vault.json", "{not valid json");
    const blob = await zip.generateAsync({ type: "blob" });

    await expect(importVault(storage, blob)).rejects.toThrow("vault.json is not valid JSON");

    expect(storage.clearAll).not.toHaveBeenCalled();
    expect(storage.putItems).not.toHaveBeenCalled();
    expect(storage.putSettings).not.toHaveBeenCalled();
    expect(storage.putFile).not.toHaveBeenCalled();
  });

  it.each([
    "../evil.txt",
    "/tmp/evil.txt",
    "C:\\temp\\evil.txt",
    "folder/evil.txt",
    "folder\\evil.txt",
    "%2e%2e%2fevil.txt",
    "CON",
    "nul.txt",
    "file..pdf",
  ])("rejects unsafe file IDs before mutating storage: %s", async (unsafeId) => {
    const storage = createMockStorage();
    const item = createItem();
    const settings: AppSettings = {
      theme: "light",
      storageMode: "local_only",
      recentItemIds: [],
    };
    const blob = await createVaultBlob({
      items: [item],
      settings,
      files: [{ id: unsafeId, type: "application/pdf", content: "malicious" }],
    });

    await expect(importVault(storage, blob)).rejects.toThrow("Invalid vault file ID");

    expect(storage.clearAll).not.toHaveBeenCalled();
    expect(storage.putItems).not.toHaveBeenCalled();
    expect(storage.putSettings).not.toHaveBeenCalled();
    expect(storage.putFile).not.toHaveBeenCalled();
  });

  it("rejects duplicate file IDs before mutating storage", async () => {
    const storage = createMockStorage();
    const item = createItem();
    const settings: AppSettings = {
      theme: "light",
      storageMode: "local_only",
      recentItemIds: [],
    };
    const blob = await createVaultBlob({
      items: [item],
      settings,
      files: [
        { id: "attachment-1.pdf", type: "application/pdf", content: "one" },
        { id: "attachment-1.pdf", type: "application/pdf", content: "two" },
      ],
    });

    await expect(importVault(storage, blob)).rejects.toThrow("duplicate file ID");

    expect(storage.clearAll).not.toHaveBeenCalled();
    expect(storage.putItems).not.toHaveBeenCalled();
    expect(storage.putFile).not.toHaveBeenCalled();
  });

  it("rejects missing manifest attachments before mutating storage", async () => {
    const storage = createMockStorage();
    const item = createItem();
    const settings: AppSettings = {
      theme: "light",
      storageMode: "local_only",
      recentItemIds: [],
    };
    const zip = new JSZip();
    zip.file(
      "vault.json",
      JSON.stringify({
        manifest: {
          schemaVersion: 1,
          exportedAt: "2026-01-01T00:00:00.000Z",
          appName: "Scholar's Haven",
          itemCount: 1,
          vaultName: "Mock Import",
          vaultId: "vault-1",
          fileCount: 1,
        },
        settings,
        items: [item],
        files: [{ id: "missing-file.pdf", type: "application/pdf", size: 10 }],
      }),
    );
    zip.folder("files");
    const blob = await zip.generateAsync({ type: "blob" });

    await expect(importVault(storage, blob)).rejects.toThrow("Missing attachment");

    expect(storage.clearAll).not.toHaveBeenCalled();
    expect(storage.putItems).not.toHaveBeenCalled();
    expect(storage.putFile).not.toHaveBeenCalled();
  });

  it("rejects manifest item/file count mismatches before mutating storage", async () => {
    const storage = createMockStorage();
    const item = createItem();
    const settings: AppSettings = {
      theme: "light",
      storageMode: "local_only",
      recentItemIds: [],
    };
    const zip = new JSZip();
    zip.file(
      "vault.json",
      JSON.stringify({
        manifest: {
          schemaVersion: 1,
          exportedAt: "2026-01-01T00:00:00.000Z",
          appName: "Scholar's Haven",
          itemCount: 2,
          vaultName: "Mock Import",
          vaultId: "vault-1",
          fileCount: 0,
        },
        settings,
        items: [item],
        files: [],
      }),
    );
    const blob = await zip.generateAsync({ type: "blob" });

    await expect(importVault(storage, blob)).rejects.toThrow("item count");

    expect(storage.clearAll).not.toHaveBeenCalled();
    expect(storage.putItems).not.toHaveBeenCalled();
  });

  it("rejects attachment size mismatches before mutating storage", async () => {
    const storage = createMockStorage();
    const item = createItem();
    const settings: AppSettings = {
      theme: "light",
      storageMode: "local_only",
      recentItemIds: [],
    };
    const zip = new JSZip();
    zip.file(
      "vault.json",
      JSON.stringify({
        manifest: {
          schemaVersion: 1,
          exportedAt: "2026-01-01T00:00:00.000Z",
          appName: "Scholar's Haven",
          itemCount: 1,
          vaultName: "Mock Import",
          vaultId: "vault-1",
          fileCount: 1,
        },
        settings,
        items: [item],
        files: [{ id: "attachment-1.pdf", type: "application/pdf", size: 999 }],
      }),
    );
    zip.folder("files")?.file("attachment-1.pdf", "short");
    const blob = await zip.generateAsync({ type: "blob" });

    await expect(importVault(storage, blob)).rejects.toThrow("size mismatch");

    expect(storage.clearAll).not.toHaveBeenCalled();
    expect(storage.putItems).not.toHaveBeenCalled();
    expect(storage.putFile).not.toHaveBeenCalled();
  });
});
