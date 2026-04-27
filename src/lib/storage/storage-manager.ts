import type { StorageAdapter } from "./storage-adapter";
import { IndexedDBAdapter } from "@/lib/db/indexeddb-adapter";

export function isTauri(): boolean {
  return false;
}

export async function getStorageAdapter(): Promise<StorageAdapter> {
  const adapter = new IndexedDBAdapter();
  await adapter.init();
  return adapter;
}
