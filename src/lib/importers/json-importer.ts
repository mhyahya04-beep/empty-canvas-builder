import type { Importer, ImportResult } from "./importer";
import { SCHEMA_VERSION, ExportBundleSchema } from "@/models/item";

export const jsonImporter: Importer<string> = {
  id: "json",
  label: "JSON Bundle",
  canHandle(input) {
    try {
      const parsed = JSON.parse(input);
      return parsed && typeof parsed === "object" && "manifest" in parsed && "items" in parsed;
    } catch {
      return false;
    }
  },
  async import(input) {
    let raw: unknown;

    try {
      raw = JSON.parse(input);
    } catch {
      throw new Error("Invalid JSON bundle: input is not valid JSON.");
    }

    const result = ExportBundleSchema.safeParse(raw);

    if (!result.success) {
      throw new Error(
        `Invalid JSON bundle format: ${result.error.errors.map((e) => e.message).join(", ")}`,
      );
    }

    const bundle = result.data;
    const warnings: string[] = [];

    if (bundle.manifest.itemCount !== bundle.items.length) {
      throw new Error(
        `Invalid JSON bundle manifest: item count is ${bundle.manifest.itemCount}, but ${bundle.items.length} items were provided.`,
      );
    }

    if (bundle.manifest?.schemaVersion !== SCHEMA_VERSION) {
      warnings.push(
        `Schema version mismatch (file: ${bundle.manifest?.schemaVersion}, app: ${SCHEMA_VERSION}). Some fields may be missing or extra.`,
      );
    }

    return { items: bundle.items, warnings } satisfies ImportResult;
  },
};
