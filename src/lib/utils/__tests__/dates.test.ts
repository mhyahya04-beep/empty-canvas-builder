import { describe, expect, it } from "vitest";
import { formatDate } from "../dates";

describe("formatDate", () => {
  it("returns the original value when the input is not a valid ISO date", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
  });
});
