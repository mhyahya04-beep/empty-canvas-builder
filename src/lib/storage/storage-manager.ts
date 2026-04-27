import type { StorageAdapter } from "./storage-adapter";
import { IndexedDBAdapter } from "@/lib/db/indexeddb-adapter";

/**
 * Detects if the app is running within a Tauri container.
 */
export function isTauri(): boolean {
  return (
    typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}

/**
 * Initializes and returns the appropriate storage adapter for the current environment.
 */
export async function getStorageAdapter(): Promise<StorageAdapter> {
  if (isTauri()) {
    try {
      // Dynamic import to avoid bundling Tauri APIs in the web build
      const { TauriFileSystemAdapter } = await import("@/lib/db/tauri-fs-adapter");
      const adapter = new TauriFileSystemAdapter();
      await adapter.init();
      return adapter;
    } catch (e) {
      console.error("Failed to initialize Tauri storage", e);
      throw new Error("Failed to initialize desktop vault storage.");
    }
  }

  const adapter = new IndexedDBAdapter();
  await adapter.init();
  return adapter;
}
