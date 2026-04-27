import { describe, expect, it } from "vitest";
import {
  coerceLegacyContentItem,
  normalizeItemLifecycle,
  setItemArchived,
  type ContentItem,
} from "../item";

function createItem(partial?: Partial<ContentItem>): ContentItem {
  return {
    id: "item-1",
    type: "note",
    title: "Lifecycle Item",
    slug: "lifecycle-item",
    subjectId: null,
    parentId: null,
    tags: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    status: "draft",
    pinned: false,
    archived: false,
    blocks: [],
    ...partial,
  };
}

describe("item lifecycle helpers", () => {
  it("normalizes drift where archived flag and status disagree", () => {
    const drifted = createItem({ status: "curated", archived: true });
    const normalized = normalizeItemLifecycle(drifted);

    expect(normalized.archived).toBe(true);
    expect(normalized.status).toBe("archived");
  });

  it("restores the previous status when unarchiving", () => {
    const archived = setItemArchived(createItem({ status: "imported" }), true);
    const restored = setItemArchived(archived, false);

    expect(archived.status).toBe("archived");
    expect(archived.archived).toBe(true);
    expect(restored.status).toBe("imported");
    expect(restored.archived).toBe(false);
  });

  it("coerces legacy items with missing status", () => {
    const legacy = createItem() as unknown as Record<string, unknown>;
    delete legacy.status;

    const repaired = coerceLegacyContentItem(legacy);

    expect(repaired).not.toBeNull();
    expect(repaired?.status).toBe("draft");
    expect(repaired?.archived).toBe(false);
  });

  it("coerces legacy archived records to archived status", () => {
    const legacy = createItem({ archived: true }) as unknown as Record<string, unknown>;
    delete legacy.status;

    const repaired = coerceLegacyContentItem(legacy);

    expect(repaired).not.toBeNull();
    expect(repaired?.status).toBe("archived");
    expect(repaired?.archived).toBe(true);
  });
});
