import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { exportAiPack, exportVault } from "../vault-exporter";
import type { StorageAdapter } from "@/lib/storage/storage-adapter";
import type { ContentItem } from "@/models/item";
import type { AppSettings } from "@/models/settings";

function createItem(partial?: Partial<ContentItem>): ContentItem {
  return {
    id: "note-abcdef123456",
    type: "note",
    title: "Mock Note",
    slug: "mock-note",
    subjectId: null,
    parentId: null,
    tags: ["mock"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    status: "curated",
    pinned: false,
    archived: false,
    blocks: [{ id: "block-1", type: "paragraph", text: "hello" }],
    ...partial,
  };
}

function createStorage({
  items,
  settings,
  files,
}: {
  items: ContentItem[];
  settings: AppSettings;
  files: { id: string; blob: Blob }[];
}): StorageAdapter {
  return {
    init: async () => {},
    getAllItems: async () => items,
    getItem: async () => undefined,
    putItem: async () => {},
    putItems: async () => {},
    deleteItem: async () => {},
    clearItems: async () => {},
    getSettings: async () => settings,
    putSettings: async () => {},
    putFile: async () => {},
    getFile: async () => undefined,
    getAllFiles: async () => files,
    deleteFile: async () => {},
    clearAll: async () => {},
  };
}

describe("vault exporter", () => {
  it("exports a vault bundle with manifest, settings, items, and binary files", async () => {
    const subject = createItem({
      id: "subject-123456",
      type: "subject",
      title: "Hadith",
      slug: "hadith",
    });
    const note = createItem({
      id: "note-abcdef123456",
      subjectId: subject.id,
    });
    const settings: AppSettings = {
      theme: "sepia",
      storageMode: "local_only",
      recentItemIds: [note.id],
    };
    const files = [
      {
        id: "attachment-1.pdf",
        blob: new Blob(["mock-pdf"], { type: "application/pdf" }),
      },
    ];
    const storage = createStorage({ items: [subject, note], settings, files });

    const blob = await exportVault(storage, "Mock Vault");
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const manifestText = await zip.file("vault.json")?.async("string");

    expect(manifestText).toBeDefined();

    const bundle = JSON.parse(manifestText ?? "{}");
    expect(bundle.manifest.appName).toBe("Scholar's Haven");
    expect(bundle.manifest.vaultName).toBe("Mock Vault");
    expect(bundle.manifest.itemCount).toBe(2);
    expect(bundle.manifest.fileCount).toBe(1);
    expect(bundle.items).toEqual([subject, note]);
    expect(bundle.settings).toEqual(settings);
    expect(bundle.files).toEqual([{ id: "attachment-1.pdf", type: "application/pdf", size: 8 }]);

    const attachmentText = await zip.file("files/attachment-1.pdf")?.async("text");
    expect(attachmentText).toBe("mock-pdf");
  });

  it("exports an AI pack with subject mapping and readable README text", async () => {
    const subject = createItem({
      id: "subject-123456",
      type: "subject",
      title: "Quran",
      slug: "quran",
    });
    const note = createItem({
      id: "note-abcdef123456",
      subjectId: subject.id,
      title: "Mock Tafsir",
      slug: "mock-tafsir",
      metadata: { source: "mock" },
    });
    const storage = createStorage({
      items: [subject, note],
      settings: {
        theme: "light",
        storageMode: "local_only",
        recentItemIds: [],
      },
      files: [],
    });

    const blob = await exportAiPack(storage);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());

    const manifestText = await zip.file("manifest.json")?.async("string");
    const readmeText = await zip.file("README.md")?.async("string");
    const itemText = await zip.file("items/mock-tafsir-note-a.json")?.async("string");

    expect(manifestText).toBeDefined();
    expect(readmeText).toContain("# Scholar's Haven - AI Pack");

    const manifest = JSON.parse(manifestText ?? "{}");
    expect(manifest.counts).toEqual({ subjects: 1, items: 1 });
    expect(manifest.subjects).toEqual([{ id: subject.id, title: "Quran", slug: "quran" }]);
    expect(manifest.items).toEqual([
      {
        id: note.id,
        type: "note",
        title: "Mock Tafsir",
        slug: "mock-tafsir",
        subject: "Quran",
        file: "items/mock-tafsir-note-a.json",
      },
    ]);

    const aiItem = JSON.parse(itemText ?? "{}");
    expect(aiItem.subject).toBe("Quran");
    expect(aiItem.metadata).toEqual({ source: "mock" });
    expect(aiItem.blocks).toEqual(note.blocks);
  });
});
