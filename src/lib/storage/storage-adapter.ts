import type { ContentItem } from "@/models/item";
import type { AppSettings } from "@/models/settings";

/**
 * Storage adapter interface. Any persistence backend (IndexedDB, OPFS,
 * remote, in-memory for tests) implements this. The rest of the app only
 * talks to this interface, never to a specific backend.
 */
export interface StorageAdapter {
  init(): Promise<void>;

  // Items
  getAllItems(): Promise<ContentItem[]>;
  getItem(id: string): Promise<ContentItem | undefined>;
  putItem(item: ContentItem): Promise<void>;
  putItems(items: ContentItem[]): Promise<void>;
  deleteItem(id: string): Promise<void>;
  clearItems(): Promise<void>;

  // Settings
  getSettings(): Promise<AppSettings | undefined>;
  putSettings(settings: AppSettings): Promise<void>;

  // Files (binary attachments such as registered PDFs)
  putFile(id: string, blob: Blob): Promise<void>;
  getFile(id: string): Promise<Blob | undefined>;
  getAllFiles(): Promise<{ id: string; blob: Blob }[]>;
  deleteFile(id: string): Promise<void>;

  /**
   * Clears ALL data (items, settings, files). Use with caution.
   */
  clearAll(): Promise<void>;
}
