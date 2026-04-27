import { describe, it, expect } from "vitest";
import { ContentItemSchema } from "../item";
import { BlockSchema } from "../block";

describe("Data Validation", () => {
  it("validates a correct note item", () => {
    const validNote = {
      id: "test-id",
      type: "note",
      title: "Test Note",
      slug: "test-note",
      subjectId: null,
      parentId: null,
      tags: ["test"],
      description: "A test note",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "draft",
      pinned: false,
      archived: false,
      blocks: [
        { id: "b1", type: "heading", level: 2, text: "Hello" },
        { id: "b2", type: "paragraph", text: "World" },
      ],
    };
    const result = ContentItemSchema.safeParse(validNote);
    expect(result.success).toBe(true);
  });

  it("rejects an item with missing fields", () => {
    const invalidNote = {
      id: "test-id",
      type: "note",
      // missing title, slug, etc.
    };
    const result = ContentItemSchema.safeParse(invalidNote);
    expect(result.success).toBe(false);
  });

  it("validates various block types", () => {
    const tableBlock = { id: "t1", type: "table", headers: ["A"], rows: [["B"]] };
    const imageBlock = { id: "i1", type: "image", src: "https://ex.com/img.png" };
    const verseBlock = { id: "v1", type: "verse", reference: "1:1", translation: "Test" };

    expect(BlockSchema.safeParse(tableBlock).success).toBe(true);
    expect(BlockSchema.safeParse(imageBlock).success).toBe(true);
    expect(BlockSchema.safeParse(verseBlock).success).toBe(true);
  });
});
