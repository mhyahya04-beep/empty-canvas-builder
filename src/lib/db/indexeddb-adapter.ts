import { openDB, type IDBPDatabase } from "idb";
import type { StorageAdapter } from "@/lib/storage/storage-adapter";
import { coerceLegacyContentItem, normalizeItemLifecycle, type ContentItem } from "@/models/item";
import type { AppSettings } from "@/models/settings";
import { assertSafeStoredFileId, validateStoredFileId } from "@/lib/files/file-id";

const DB_NAME = "study-vault";
const DB_VERSION = 3;
const ITEMS_STORE = "items";
const META_STORE = "meta";
const FILES_STORE = "files";
const SETTINGS_KEY = "settings";

export class IndexedDBAdapter implements StorageAdapter {
  private dbPromise: Promise<IDBPDatabase> | null = null;

  private getDb(): Promise<IDBPDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion, newVersion, transaction) {
          console.debug(`Upgrading DB from ${oldVersion} to ${newVersion}`);

          if (oldVersion < 1) {
            const store = db.createObjectStore(ITEMS_STORE, { keyPath: "id" });
            store.createIndex("subjectId", "subjectId");
            store.createIndex("type", "type");
            store.createIndex("updatedAt", "updatedAt");
            db.createObjectStore(META_STORE);
          }

          if (oldVersion < 2 && !db.objectStoreNames.contains(FILES_STORE)) {
            db.createObjectStore(FILES_STORE);
          }

          if (oldVersion < 3) {
            // v3 lifecycle backfill runs in init() via backfillLegacyItems().
            // Keep upgrade callback synchronous and schema-focused.
            transaction.objectStore(ITEMS_STORE);
          }
        },
      });
    }
    return this.dbPromise;
  }

  async init(): Promise<void> {
    await this.getDb();
    await this.backfillLegacyItems();
  }

  private async backfillLegacyItems(): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(ITEMS_STORE, "readwrite");
    let cursor = await tx.store.openCursor();

    while (cursor) {
      const raw = cursor.value;
      const repaired = coerceLegacyContentItem(raw);

      if (repaired) {
        const rawStatus = (raw as { status?: unknown }).status;
        const rawArchived = (raw as { archived?: unknown }).archived;
        if (rawStatus !== repaired.status || rawArchived !== repaired.archived) {
          await cursor.update(repaired);
        }
      }

      cursor = await cursor.continue();
    }

    await tx.done;
  }

  async getAllItems(): Promise<ContentItem[]> {
    const db = await this.getDb();
    return db.getAll(ITEMS_STORE);
  }

  async getItem(id: string): Promise<ContentItem | undefined> {
    const db = await this.getDb();
    return db.get(ITEMS_STORE, id);
  }

  async putItem(item: ContentItem): Promise<void> {
    const db = await this.getDb();
    await db.put(ITEMS_STORE, normalizeItemLifecycle(item));
  }

  async putItems(items: ContentItem[]): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(ITEMS_STORE, "readwrite");
    await Promise.all(items.map((i) => tx.store.put(normalizeItemLifecycle(i))));
    await tx.done;
  }

  async deleteItem(id: string): Promise<void> {
    const db = await this.getDb();
    await db.delete(ITEMS_STORE, id);
  }

  async clearItems(): Promise<void> {
    const db = await this.getDb();
    await db.clear(ITEMS_STORE);
  }

  async getSettings(): Promise<AppSettings | undefined> {
    const db = await this.getDb();
    return db.get(META_STORE, SETTINGS_KEY);
  }

  async putSettings(settings: AppSettings): Promise<void> {
    const db = await this.getDb();
    await db.put(META_STORE, settings, SETTINGS_KEY);
  }

  async putFile(id: string, blob: Blob): Promise<void> {
    assertSafeStoredFileId(id);
    const db = await this.getDb();
    await db.put(FILES_STORE, blob, id);
  }

  async getFile(id: string): Promise<Blob | undefined> {
    assertSafeStoredFileId(id);
    const db = await this.getDb();
    return db.get(FILES_STORE, id);
  }

  async getAllFiles(): Promise<{ id: string; blob: Blob }[]> {
    const db = await this.getDb();
    const tx = db.transaction(FILES_STORE, "readonly");
    const store = tx.objectStore(FILES_STORE);

    let cursor = await store.openCursor();
    const results: { id: string; blob: Blob }[] = [];

    while (cursor) {
      const id = cursor.key as string;
      const validation = validateStoredFileId(id);
      if (!validation.valid) {
        console.warn(`Skipping unsafe stored file "${id}": ${validation.reason}`);
        cursor = await cursor.continue();
        continue;
      }

      results.push({
        id,
        blob: cursor.value as Blob,
      });
      cursor = await cursor.continue();
    }

    return results;
  }

  async deleteFile(id: string): Promise<void> {
    assertSafeStoredFileId(id);
    const db = await this.getDb();
    await db.delete(FILES_STORE, id);
  }

  async clearAll(): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction([ITEMS_STORE, META_STORE, FILES_STORE], "readwrite");
    await Promise.all([
      tx.objectStore(ITEMS_STORE).clear(),
      tx.objectStore(META_STORE).clear(),
      tx.objectStore(FILES_STORE).clear(),
    ]);
    await tx.done;
  }
}

export const storage: StorageAdapter = new IndexedDBAdapter();
