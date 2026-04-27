import { describe, expect, it } from "vitest";
import { assertPathInsideDirectory, validateStoredFileId } from "@/lib/files/file-id";

describe("stored file ID policy", () => {
  it.each(["file-1", "attachment-1.pdf", "seed-quran-yusuf-ali-translation", "abc_123.XYZ"])(
    "accepts safe file ID %s",
    (fileId) => {
      expect(validateStoredFileId(fileId)).toEqual({ valid: true });
    },
  );

  it.each([
    "",
    " ../evil.txt",
    "../evil.txt",
    "..\\evil.txt",
    "/tmp/evil.txt",
    "C:\\temp\\evil.txt",
    "folder/evil.txt",
    "folder\\evil.txt",
    "%2e%2e%2fevil.txt",
    "CON",
    "con.txt",
    "LPT1",
    "file..pdf",
    "evil\u{1F4A5}.pdf",
  ])("rejects unsafe file ID %s", (fileId) => {
    expect(validateStoredFileId(fileId).valid).toBe(false);
  });

  it("rejects resolved paths outside the vault files directory", () => {
    expect(() => assertPathInsideDirectory("/vault/evil.txt", "/vault/files")).toThrow(
      "escaped the vault files directory",
    );
  });

  it("accepts resolved paths inside the vault files directory", () => {
    expect(() =>
      assertPathInsideDirectory("/vault/files/file-1.pdf", "/vault/files"),
    ).not.toThrow();
  });
});
