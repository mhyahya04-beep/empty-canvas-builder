import { describe, expect, it } from "vitest";
import { jsonImporter } from "../json-importer";
import { SCHEMA_VERSION, type ContentItem } from "@/models/item";

function createItem(): ContentItem {
  return {
    id: "note-1",
    type: "note",
    title: "Note",
    slug: "note",
    subjectId: null,
    parentId: null,
    tags: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    status: "imported",
    pinned: false,
    archived: false,
    blocks: [{ id: "block-1", type: "paragraph", text: "Hello" }],
  };
}

describe("JSON importer", () => {
  it("rejects malformed JSON with a deterministic error", async () => {
    await expect(jsonImporter.import("{invalid")).rejects.toThrow("not valid JSON");
  });

  it("imports schema-valid JSON bundles", async () => {
    const item = createItem();
    const result = await jsonImporter.import(
      JSON.stringify({
        manifest: {
          schemaVersion: SCHEMA_VERSION,
          exportedAt: "2026-01-01T00:00:00.000Z",
          appName: "Scholar's Haven",
          itemCount: 1,
        },
        items: [item],
      }),
    );

    expect(result.items).toEqual([item]);
    expect(result.warnings).toEqual([]);
  });

  it("rejects manifest item count mismatches", async () => {
    const item = createItem();

    await expect(
      jsonImporter.import(
        JSON.stringify({
          manifest: {
            schemaVersion: SCHEMA_VERSION,
            exportedAt: "2026-01-01T00:00:00.000Z",
            appName: "Scholar's Haven",
            itemCount: 2,
          },
          items: [item],
        }),
      ),
    ).rejects.toThrow("item count");
  });
});
