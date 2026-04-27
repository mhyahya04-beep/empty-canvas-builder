import { beforeEach, describe, expect, it, vi } from "vitest";
import { migrateLegacyTargetItems } from "@/lib/migration/legacy-items";
import { buildNamespacedId } from "@/lib/migration/shape";
import { db } from "@/lib/db/db";
import { ensureRequiredWorkspaceStructure, listAttachments } from "@/lib/storage";
import { resetUnifiedDb } from "@/test/db";
import type { ContentItem } from "@/models/item";

const { mockLegacyStorage } = vi.hoisted(() => ({
  mockLegacyStorage: {
    items: [] as ContentItem[],
  },
}));

vi.mock("@/lib/storage/active-storage", () => ({
  getActiveStorage: async () => ({
    getAllItems: async () => mockLegacyStorage.items,
  }),
}));

function createLegacyItem(overrides: Partial<ContentItem>): ContentItem {
  const timestamp = "2026-04-20T12:00:00.000Z";
  return {
    id: overrides.id ?? "item-1",
    type: overrides.type ?? "note",
    title: overrides.title ?? "Legacy Item",
    slug: overrides.slug ?? "legacy-item",
    subjectId: overrides.subjectId ?? null,
    parentId: overrides.parentId ?? null,
    tags: overrides.tags ?? [],
    description: overrides.description,
    createdAt: overrides.createdAt ?? timestamp,
    updatedAt: overrides.updatedAt ?? timestamp,
    status: overrides.status ?? "curated",
    pinned: overrides.pinned ?? false,
    archived: overrides.archived ?? false,
    source: overrides.source,
    metadata: overrides.metadata,
    blocks: overrides.blocks ?? [],
  };
}

describe("migrateLegacyTargetItems", () => {
  beforeEach(async () => {
    mockLegacyStorage.items = [];
    await resetUnifiedDb();
    await ensureRequiredWorkspaceStructure();
  });

  it("converts legacy study-vault items into unified records with preserved attachments", async () => {
    mockLegacyStorage.items = [
      createLegacyItem({
        id: "subject-1",
        type: "subject",
        title: "Computer Science",
        slug: "computer-science",
      }),
      createLegacyItem({
        id: "note-1",
        type: "note",
        title: "Revision Notes",
        slug: "revision-notes",
        subjectId: "subject-1",
        description: "Legacy study note.",
        blocks: [
          {
            id: "block-1",
            type: "paragraph",
            text: "Focus on algorithms first.",
          },
        ],
      }),
      createLegacyItem({
        id: "pdf-1",
        type: "pdf_library_item",
        title: "Passport Scan",
        slug: "passport-scan",
        source: {
          origin: "pdf",
          originalFilename: "passport.pdf",
        },
        metadata: {
          mimeType: "application/pdf",
          filePath: "/archive/passport.pdf",
        },
      }),
    ];

    const manifest = await migrateLegacyTargetItems();

    expect(manifest.status).toBe("completed");
    expect(manifest.counts.records).toBe(3);
    expect(manifest.counts.attachments).toBe(1);

    const studyNoteId = buildNamespacedId("target", "legacy-item", "note-1");
    const studyNote = await db.records.get(studyNoteId);
    expect(studyNote?.type).toBe("note");
    expect(studyNote?.properties.subject).toBe("Computer Science");

    const knowledgeRecord = await db.records.get(buildNamespacedId("target", "legacy-item", "subject-1"));
    expect(knowledgeRecord?.type).toBe("knowledge_item");

    const attachments = await listAttachments(buildNamespacedId("target", "legacy-item", "pdf-1"));
    expect(attachments).toHaveLength(1);
    expect(attachments[0]?.localPath).toBe("/archive/passport.pdf");

    const rerun = await migrateLegacyTargetItems();
    expect(rerun.completedAt).toBe(manifest.completedAt);
    expect(await db.records.where("source").equals("target").count()).toBe(3);
  });
});
