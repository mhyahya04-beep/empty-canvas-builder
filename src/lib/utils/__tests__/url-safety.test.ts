import { describe, expect, it } from "vitest";
import {
  formatSafeUrlHost,
  isSafeWebUrl,
  sanitizeCssColor,
  sanitizeCssCustomPropertyName,
  toSafeLocalAssetUrl,
  toSafeImageSrc,
  toSafeWebHref,
} from "../url-safety";

describe("URL and CSS safety helpers", () => {
  it.each(["https://example.com/path", "http://localhost:5173/demo"])(
    "allows ordinary web URLs: %s",
    (url) => {
      expect(isSafeWebUrl(url)).toBe(true);
      expect(toSafeWebHref(url)).toBe(new URL(url).href);
      expect(toSafeImageSrc(url)).toBe(new URL(url).href);
    },
  );

  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///C:/Windows/win.ini",
    "blob:https://example.com/123",
    "not a url",
  ])("rejects non-web or malformed URLs: %s", (url) => {
    expect(isSafeWebUrl(url)).toBe(false);
    expect(toSafeWebHref(url)).toBeNull();
    expect(toSafeImageSrc(url)).toBeNull();
  });

  it("formats safe hosts without exposing unsafe URL text as a host", () => {
    expect(formatSafeUrlHost("https://www.example.com/page")).toBe("example.com");
    expect(formatSafeUrlHost("javascript:alert(1)")).toBe("Blocked unsafe URL");
  });

  it("allows local asset URLs but rejects remote seed URLs", () => {
    expect(toSafeLocalAssetUrl("/assets/document.pdf")).toBe("/assets/document.pdf");
    expect(toSafeLocalAssetUrl("./assets/document.pdf")).toBe("/assets/document.pdf");
    expect(toSafeLocalAssetUrl("https://example.com/document.pdf")).toBeNull();
    expect(toSafeLocalAssetUrl("javascript:alert(1)")).toBeNull();
  });

  it.each(["primary", "_series-1", "series_2"])(
    "allows safe CSS custom-property names: %s",
    (name) => {
      expect(sanitizeCssCustomPropertyName(name)).toBe(name);
    },
  );

  it.each(["bad; color:red", "1bad", "x} body { color:red", "a/b"])(
    "rejects unsafe CSS custom-property names: %s",
    (name) => {
      expect(sanitizeCssCustomPropertyName(name)).toBeNull();
    },
  );

  it.each([
    "#fff",
    "#112233",
    "rgb(1, 2, 3)",
    "rgba(1, 2, 3, 0.5)",
    "hsl(120, 50%, 50%)",
    "red",
    "var(--chart-1)",
  ])("allows bounded CSS color tokens: %s", (color) => {
    expect(sanitizeCssColor(color)).toBe(color);
  });

  it.each([
    "red; background:url(javascript:alert(1))",
    "url(https://example.com/x)",
    "var(--x); color:red",
    "expression(alert(1))",
  ])("rejects CSS declarations and functions outside the allow-list: %s", (color) => {
    expect(sanitizeCssColor(color)).toBeNull();
  });
});
