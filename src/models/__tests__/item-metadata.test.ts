import { describe, expect, it } from "vitest";
import { getPdfAttachmentMetadata, getResourceGroups, getSavedLinks } from "../item-metadata";

describe("item metadata helpers", () => {
  it("returns safe defaults for invalid metadata payloads", () => {
    expect(getSavedLinks("invalid" as never)).toEqual([]);
    expect(getResourceGroups(undefined)).toEqual([]);
    expect(getPdfAttachmentMetadata(undefined)).toBeNull();
  });

  it("extracts known metadata shapes without crashing", () => {
    expect(
      getSavedLinks({
        links: [{ url: "https://example.com", title: "Example", source: "Example" }],
      }),
    ).toEqual([{ url: "https://example.com", title: "Example", source: "Example" }]);

    expect(
      getResourceGroups({
        groups: [{ name: "Primary", items: ["Alpha", "Beta"] }],
      }),
    ).toEqual([{ name: "Primary", items: ["Alpha", "Beta"] }]);

    expect(
      getPdfAttachmentMetadata({
        fileId: "file-1",
        originalFilename: "notes.pdf",
      }),
    ).toEqual({
      fileId: "file-1",
      originalFilename: "notes.pdf",
    });
  });

  it("filters unsafe saved links without dropping valid links", () => {
    expect(
      getSavedLinks({
        links: [
          { url: "javascript:alert(1)", title: "Bad" },
          { url: "https://example.com", title: "Good" },
          { url: "file:///tmp/secret", title: "Local file" },
        ],
      }),
    ).toEqual([{ url: "https://example.com", title: "Good" }]);
  });

  it("rejects PDF attachment metadata with unsafe file IDs", () => {
    expect(
      getPdfAttachmentMetadata({
        fileId: "../outside.pdf",
        originalFilename: "outside.pdf",
      }),
    ).toBeNull();
  });
});
