import { describe, expect, it } from "vitest";
import { linkImporter } from "../link-importer";

describe("link importer", () => {
  it("normalizes and imports HTTP(S) links", async () => {
    expect(linkImporter.canHandle({ url: " https://www.example.com/path " })).toBe(true);

    const result = await linkImporter.import({
      url: " https://www.example.com/path ",
      title: "Example",
      note: "Read later",
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].source?.url).toBe("https://www.example.com/path");
    expect(result.items[0].metadata).toEqual({
      links: [
        {
          url: "https://www.example.com/path",
          title: "Example",
          source: "example.com",
          note: "Read later",
        },
      ],
    });
  });

  it.each(["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "file:///tmp/x"])(
    "rejects unsafe protocols: %s",
    async (url) => {
      expect(linkImporter.canHandle({ url })).toBe(false);
      await expect(linkImporter.import({ url })).rejects.toThrow("HTTP and HTTPS");
    },
  );
});
