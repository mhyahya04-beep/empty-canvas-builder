import type { StorageAdapter } from "./storage-adapter";
import { getStorageAdapter } from "./storage-manager";

let activeAdapter: StorageAdapter | null = null;
let activeAdapterPromise: Promise<StorageAdapter> | null = null;

/**
 * Gets the singleton storage adapter, initializing it if necessary.
 * Concurrent callers share the same in-flight initialization work.
 */
export async function getActiveStorage(): Promise<StorageAdapter> {
  if (activeAdapter) {
    return activeAdapter;
  }

  if (!activeAdapterPromise) {
    activeAdapterPromise = getStorageAdapter()
      .then((adapter) => {
        activeAdapter = adapter;
        return adapter;
      })
      .catch((error: unknown) => {
        activeAdapterPromise = null;
        throw error;
      });
  }

  return activeAdapterPromise;
}

/**
 * Test-only reset hook so isolated module tests can verify initialization logic.
 */
export function __resetActiveStorageForTests() {
  activeAdapter = null;
  activeAdapterPromise = null;
}
