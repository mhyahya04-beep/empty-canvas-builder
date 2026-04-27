import { z } from "zod";
import { ContentItemSchema, ExportManifestSchema } from "./item";
import { AppSettingsSchema } from "./settings";

/**
 * A VaultBundle represents the entire state of a study vault.
 * This is the format used for portable ZIP exports/imports.
 */
export const VaultBundleSchema = z.object({
  manifest: ExportManifestSchema.extend({
    vaultName: z.string(),
    vaultId: z.string(),
    fileCount: z.number(),
  }),
  settings: AppSettingsSchema,
  items: z.array(ContentItemSchema),
  // File metadata (the actual blobs live in the ZIP's 'files/' directory)
  files: z.array(
    z.object({
      id: z.string(),
      type: z.string(), // mime type
      size: z.number(),
      name: z.string().optional(),
    }),
  ),
});

export type VaultBundle = z.infer<typeof VaultBundleSchema>;

/**
 * Standard filenames for vault structure
 */
export const VAULT_FILE_NAMES = {
  MANIFEST: "vault.json",
  FILES_DIR: "files",
} as const;
