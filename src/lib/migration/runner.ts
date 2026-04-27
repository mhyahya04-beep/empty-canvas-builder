import { ensureRequiredWorkspaceStructure } from "@/lib/storage";
import { migrateLegacyTargetItems } from "@/lib/migration/legacy-items";
export { importCookbookDocuments } from "@/lib/migration/cookbook";
export { importVaultStructuredSnapshot, importVaultExportZip, parseVaultExportZip } from "@/lib/migration/vault-source";

let bootstrapPromise: Promise<void> | null = null;

async function runBootstrap() {
  await ensureRequiredWorkspaceStructure();
  try {
    await migrateLegacyTargetItems();
  } catch (error) {
    console.warn("Legacy target item migration skipped", error);
  }
}

export async function bootUnifiedLifeVaultMigration(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = runBootstrap().catch((error) => {
      bootstrapPromise = null;
      throw error;
    });
  }
  return bootstrapPromise;
}
