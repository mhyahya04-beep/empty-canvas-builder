import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@/models/settings";
import type { ContentItem } from "@/models/item";

const tauriState = vi.hoisted(() => {
  const textFiles = new Map<string, string>();
  const binaryFiles = new Map<string, Uint8Array>();
  const directories = new Set<string>();

  const normalize = (path: string) => path.replace(/\\/g, "/").replace(/\/+/g, "/");

  const removePath = (targetPath: string, recursive = false) => {
    const normalizedTarget = normalize(targetPath);

    if (recursive) {
      for (const path of [...textFiles.keys()]) {
        if (path === normalizedTarget || path.startsWith(`${normalizedTarget}/`)) {
          textFiles.delete(path);
        }
      }

      for (const path of [...binaryFiles.keys()]) {
        if (path === normalizedTarget || path.startsWith(`${normalizedTarget}/`)) {
          binaryFiles.delete(path);
        }
      }

      for (const path of [...directories]) {
        if (path === normalizedTarget || path.startsWith(`${normalizedTarget}/`)) {
          directories.delete(path);
        }
      }

      return;
    }

    textFiles.delete(normalizedTarget);
    binaryFiles.delete(normalizedTarget);
    directories.delete(normalizedTarget);
  };

  return {
    textFiles,
    binaryFiles,
    directories,
    normalize,
    reset() {
      textFiles.clear();
      binaryFiles.clear();
      directories.clear();
    },
    removePath,
  };
});

vi.mock("@tauri-apps/api/path", () => ({
  appDataDir: vi.fn(async () => "/app-data"),
  join: vi.fn(async (...parts: string[]) => tauriState.normalize(parts.filter(Boolean).join("/"))),
  normalize: vi.fn(async (path: string) => tauriState.normalize(path)),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFile: vi.fn(async (path: string) => {
    const normalizedPath = tauriState.normalize(path);
    const content = tauriState.textFiles.get(normalizedPath);
    if (content === undefined) {
      throw new Error(`Missing text file: ${normalizedPath}`);
    }

    return content;
  }),
  writeTextFile: vi.fn(async (path: string, content: string) => {
    tauriState.textFiles.set(tauriState.normalize(path), content);
  }),
  readDir: vi.fn(async (path: string) => {
    const normalizedPath = tauriState.normalize(path);
    const childNames = new Set<string>();

    for (const filePath of [...tauriState.textFiles.keys(), ...tauriState.binaryFiles.keys()]) {
      if (!filePath.startsWith(`${normalizedPath}/`)) {
        continue;
      }

      const childName = filePath.slice(normalizedPath.length + 1).split("/")[0];
      if (childName) {
        childNames.add(childName);
      }
    }

    return [...childNames].map((name) => ({ isFile: true, name }));
  }),
  mkdir: vi.fn(async (path: string) => {
    tauriState.directories.add(tauriState.normalize(path));
  }),
  remove: vi.fn(async (path: string, options?: { recursive?: boolean }) => {
    tauriState.removePath(path, options?.recursive ?? false);
  }),
  exists: vi.fn(async (path: string) => {
    const normalizedPath = tauriState.normalize(path);
    return (
      tauriState.directories.has(normalizedPath) ||
      tauriState.textFiles.has(normalizedPath) ||
      tauriState.binaryFiles.has(normalizedPath)
    );
  }),
  writeFile: vi.fn(async (path: string, data: Uint8Array) => {
    tauriState.binaryFiles.set(tauriState.normalize(path), data);
  }),
  readFile: vi.fn(async (path: string) => {
    const normalizedPath = tauriState.normalize(path);
    const data = tauriState.binaryFiles.get(normalizedPath);
    if (!data) {
      throw new Error(`Missing binary file: ${normalizedPath}`);
    }

    return data;
  }),
  rename: vi.fn(async (oldPath: string, newPath: string) => {
    const normalizedOldPath = tauriState.normalize(oldPath);
    const normalizedNewPath = tauriState.normalize(newPath);

    if (tauriState.textFiles.has(normalizedOldPath)) {
      tauriState.textFiles.set(normalizedNewPath, tauriState.textFiles.get(normalizedOldPath)!);
      tauriState.textFiles.delete(normalizedOldPath);
      return;
    }

    if (tauriState.binaryFiles.has(normalizedOldPath)) {
      tauriState.binaryFiles.set(normalizedNewPath, tauriState.binaryFiles.get(normalizedOldPath)!);
      tauriState.binaryFiles.delete(normalizedOldPath);
      return;
    }

    throw new Error(`Missing path to rename: ${normalizedOldPath}`);
  }),
}));

import { remove, rename } from "@tauri-apps/plugin-fs";
import { TauriFileSystemAdapter } from "../tauri-fs-adapter";

function createItem(partial?: Partial<ContentItem>): ContentItem {
  return {
    id: "note-1",
    type: "note",
    title: "Mock Note",
    slug: "mock-note",
    subjectId: null,
    parentId: null,
    tags: ["mock"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    status: "draft",
    pinned: false,
    archived: false,
    blocks: [{ id: "block-1", type: "paragraph", text: "hello" }],
    ...partial,
  };
}

beforeEach(() => {
  tauriState.reset();
  vi.clearAllMocks();
});

describe("TauriFileSystemAdapter", () => {
  it("recovers from a corrupt vault file by backing it up and resetting state", async () => {
    tauriState.textFiles.set("/mock-vault/vault.json", "{not valid json");

    const adapter = new TauriFileSystemAdapter("/mock-vault");
    await adapter.init();

    const savedVault = tauriState.textFiles.get("/mock-vault/vault.json");
    expect(savedVault).toBeDefined();

    const parsedVault = JSON.parse(savedVault ?? "{}");
    expect(parsedVault.items).toEqual([]);
    expect(parsedVault.settings).toEqual(DEFAULT_SETTINGS);

    const backupEntry = [...tauriState.textFiles.entries()].find(([path]) =>
      path.startsWith("/mock-vault/vault.corrupt-"),
    );

    expect(backupEntry).toBeDefined();
    expect(backupEntry?.[1]).toBe("{not valid json");
    await expect(adapter.getAllItems()).resolves.toEqual([]);
    await expect(adapter.getSettings()).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it("falls back to default settings when stored settings are invalid", async () => {
    const item = createItem();
    tauriState.textFiles.set(
      "/mock-vault/vault.json",
      JSON.stringify({
        items: [item],
        settings: {
          theme: "neon",
          storageMode: "local_only",
          recentItemIds: ["note-1"],
        },
      }),
    );

    const adapter = new TauriFileSystemAdapter("/mock-vault");
    await adapter.init();

    await expect(adapter.getAllItems()).resolves.toEqual([item]);
    await expect(adapter.getSettings()).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it("clears binary files and recreates the files directory during a full reset", async () => {
    tauriState.textFiles.set(
      "/mock-vault/vault.json",
      JSON.stringify({ items: [], settings: DEFAULT_SETTINGS }),
    );
    tauriState.directories.add("/mock-vault");
    tauriState.directories.add("/mock-vault/files");
    tauriState.binaryFiles.set("/mock-vault/files/file-1", new Uint8Array([1, 2, 3]));

    const adapter = new TauriFileSystemAdapter("/mock-vault");
    await adapter.init();
    await adapter.clearAll();

    expect(tauriState.binaryFiles.has("/mock-vault/files/file-1")).toBe(false);
    expect(tauriState.directories.has("/mock-vault/files")).toBe(true);
    expect(vi.mocked(remove)).toHaveBeenCalledWith("/mock-vault/files", { recursive: true });
  });

  it("writes vault state through a temp file and keeps a last-known-good backup", async () => {
    const adapter = new TauriFileSystemAdapter("/mock-vault");
    await adapter.init();

    await adapter.putItem(createItem());

    const primary = tauriState.textFiles.get("/mock-vault/vault.json");
    const backup = tauriState.textFiles.get("/mock-vault/vault.json.bak");

    expect(primary).toBeDefined();
    expect(backup).toBeDefined();
    expect(tauriState.textFiles.has("/mock-vault/vault.json.tmp")).toBe(false);
    expect(vi.mocked(rename)).toHaveBeenCalledWith(
      "/mock-vault/vault.json.tmp",
      "/mock-vault/vault.json",
    );

    const parsedPrimary = JSON.parse(primary ?? "{}");
    const parsedBackup = JSON.parse(backup ?? "{}");
    expect(parsedPrimary.revision).toBe(2);
    expect(parsedPrimary.items).toHaveLength(1);
    expect(parsedBackup.revision).toBe(1);
  });

  it("normalizes lifecycle drift before persisting items", async () => {
    const adapter = new TauriFileSystemAdapter("/mock-vault");
    await adapter.init();

    await adapter.putItem(createItem({ id: "lifecycle-1", status: "curated", archived: true }));
    await adapter.putItems([
      createItem({ id: "lifecycle-2", status: "archived", archived: false }),
    ]);

    const items = await adapter.getAllItems();
    const archivedById = new Map(items.map((item) => [item.id, item]));

    expect(archivedById.get("lifecycle-1")?.status).toBe("archived");
    expect(archivedById.get("lifecycle-1")?.archived).toBe(true);
    expect(archivedById.get("lifecycle-2")?.status).toBe("archived");
    expect(archivedById.get("lifecycle-2")?.archived).toBe(true);
  });

  it("restores a valid backup when the primary vault file is corrupt", async () => {
    tauriState.textFiles.set("/mock-vault/vault.json", "{not valid json");
    tauriState.textFiles.set(
      "/mock-vault/vault.json.bak",
      JSON.stringify({
        items: [createItem()],
        settings: DEFAULT_SETTINGS,
        revision: 7,
      }),
    );

    const adapter = new TauriFileSystemAdapter("/mock-vault");
    await adapter.init();

    await expect(adapter.getAllItems()).resolves.toHaveLength(1);
    const restoredPrimary = JSON.parse(tauriState.textFiles.get("/mock-vault/vault.json") ?? "{}");
    expect(restoredPrimary.revision).toBe(8);
    expect(restoredPrimary.items).toHaveLength(1);
  });

  it("promotes a valid orphan temp file only when no primary vault exists", async () => {
    tauriState.textFiles.set(
      "/mock-vault/vault.json.tmp",
      JSON.stringify({
        items: [createItem()],
        settings: DEFAULT_SETTINGS,
        revision: 3,
      }),
    );

    const adapter = new TauriFileSystemAdapter("/mock-vault");
    await adapter.init();

    await expect(adapter.getAllItems()).resolves.toHaveLength(1);
    expect(tauriState.textFiles.has("/mock-vault/vault.json.tmp")).toBe(false);
    expect(JSON.parse(tauriState.textFiles.get("/mock-vault/vault.json") ?? "{}").revision).toBe(3);
  });

  it("refuses to overwrite a newer on-disk revision from another writer", async () => {
    tauriState.textFiles.set(
      "/mock-vault/vault.json",
      JSON.stringify({ items: [], settings: DEFAULT_SETTINGS, revision: 1 }),
    );

    const adapter = new TauriFileSystemAdapter("/mock-vault");
    await adapter.init();

    tauriState.textFiles.set(
      "/mock-vault/vault.json",
      JSON.stringify({
        items: [createItem({ id: "other-window" })],
        settings: DEFAULT_SETTINGS,
        revision: 2,
      }),
    );

    await expect(adapter.putItem(createItem())).rejects.toThrow("Vault changed on disk");
    const primary = JSON.parse(tauriState.textFiles.get("/mock-vault/vault.json") ?? "{}");
    expect(primary.items[0].id).toBe("other-window");
  });

  it("preserves attachment MIME metadata across disk roundtrips", async () => {
    const adapter = new TauriFileSystemAdapter("/mock-vault");
    await adapter.init();

    const pdfBlob = new Blob(["mock-pdf"], { type: "application/pdf" });
    await adapter.putFile("file-1", pdfBlob);

    const loaded = await adapter.getFile("file-1");
    expect(loaded).toBeDefined();
    expect(loaded?.type).toBe("application/pdf");

    const listed = await adapter.getAllFiles();
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe("file-1");
    expect(listed[0].blob.type).toBe("application/pdf");
  });

  it("restores MIME metadata after reloading adapter state", async () => {
    const first = new TauriFileSystemAdapter("/mock-vault");
    await first.init();

    await first.putFile("file-2", new Blob(["pdf-content"], { type: "application/pdf" }));

    const second = new TauriFileSystemAdapter("/mock-vault");
    await second.init();

    const restored = await second.getFile("file-2");
    expect(restored).toBeDefined();
    expect(restored?.type).toBe("application/pdf");
  });

  it("infers MIME type from legacy item metadata when file metadata is missing", async () => {
    tauriState.textFiles.set(
      "/mock-vault/vault.json",
      JSON.stringify({
        items: [
          createItem({
            id: "pdf-item-1",
            type: "pdf_library_item",
            metadata: {
              fileId: "legacy-file-id",
              originalFilename: "legacy-document.pdf",
              originalFormat: "pdf",
            },
          }),
        ],
        settings: DEFAULT_SETTINGS,
      }),
    );
    tauriState.directories.add("/mock-vault");
    tauriState.directories.add("/mock-vault/files");
    tauriState.binaryFiles.set("/mock-vault/files/legacy-file-id", new Uint8Array([1, 2, 3]));

    const adapter = new TauriFileSystemAdapter("/mock-vault");
    await adapter.init();

    const blob = await adapter.getFile("legacy-file-id");
    expect(blob).toBeDefined();
    expect(blob?.type).toBe("application/pdf");
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
  ])("rejects unsafe file IDs before filesystem access: %s", async (unsafeId) => {
    const adapter = new TauriFileSystemAdapter("/mock-vault");
    await adapter.init();

    await expect(
      adapter.putFile(unsafeId, new Blob(["bad"], { type: "application/pdf" })),
    ).rejects.toThrow("Unsafe stored file ID");

    expect([...tauriState.binaryFiles.keys()]).toEqual([]);
  });

  it("skips unsafe existing files when listing attachments", async () => {
    tauriState.textFiles.set(
      "/mock-vault/vault.json",
      JSON.stringify({ items: [], settings: DEFAULT_SETTINGS }),
    );
    tauriState.directories.add("/mock-vault");
    tauriState.directories.add("/mock-vault/files");
    tauriState.binaryFiles.set("/mock-vault/files/safe-file.pdf", new Uint8Array([1]));
    tauriState.binaryFiles.set("/mock-vault/files/CON", new Uint8Array([2]));

    const adapter = new TauriFileSystemAdapter("/mock-vault");
    await adapter.init();

    const listed = await adapter.getAllFiles();

    expect(listed.map((file) => file.id)).toEqual(["safe-file.pdf"]);
  });
});
