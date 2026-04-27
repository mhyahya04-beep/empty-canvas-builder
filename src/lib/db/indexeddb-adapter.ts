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

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export class IndexedDBAdapter implements StorageAdapter {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private async getDb(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(ITEMS_STORE)) {
            const store = database.createObjectStore(ITEMS_STORE, { keyPath: "id" });
            store.createIndex("subjectId", "subjectId", { unique: false });
            store.createIndex("type", "type", { unique: false });
            store.createIndex("updatedAt", "updatedAt", { unique: false });
          }
          if (!database.objectStoreNames.contains(META_STORE)) {
            database.createObjectStore(META_STORE);
          }
          if (!database.objectStoreNames.contains(FILES_STORE)) {
            database.createObjectStore(FILES_STORE);
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Failed to open legacy study-vault database"));
      });
    }
    return this.dbPromise;
  }

  async init(): Promise<void> {
    await this.getDb();
    await this.backfillLegacyItems();
  }

  private async backfillLegacyItems(): Promise<void> {
    const database = await this.getDb();
    const transaction = database.transaction(ITEMS_STORE, "readwrite");
    const store = transaction.objectStore(ITEMS_STORE);
    const records = await requestToPromise(store.getAll() as IDBRequest<unknown[]>);
    for (const raw of records) {
      const repaired = coerceLegacyContentItem(raw);
      if (repaired) {
        await requestToPromise(store.put(repaired) as IDBRequest<IDBValidKey>);
      }
    }
    await transactionDone(transaction);
  }

  async getAllItems(): Promise<ContentItem[]> {
    const database = await this.getDb();
    const transaction = database.transaction(ITEMS_STORE, "readonly");
    const items = await requestToPromise(transaction.objectStore(ITEMS_STORE).getAll() as IDBRequest<ContentItem[]>);
    await transactionDone(transaction);
    return items;
  }

  async getItem(id: string): Promise<ContentItem | undefined> {
    const database = await this.getDb();
    const transaction = database.transaction(ITEMS_STORE, "readonly");
    const item = await requestToPromise(transaction.objectStore(ITEMS_STORE).get(id) as IDBRequest<ContentItem | undefined>);
    await transactionDone(transaction);
    return item;
  }

  async putItem(item: ContentItem): Promise<void> {
    const database = await this.getDb();
    const transaction = database.transaction(ITEMS_STORE, "readwrite");
    await requestToPromise(transaction.objectStore(ITEMS_STORE).put(normalizeItemLifecycle(item)) as IDBRequest<IDBValidKey>);
    await transactionDone(transaction);
  }

  async putItems(items: ContentItem[]): Promise<void> {
    const database = await this.getDb();
    const transaction = database.transaction(ITEMS_STORE, "readwrite");
    for (const item of items) {
      await requestToPromise(transaction.objectStore(ITEMS_STORE).put(normalizeItemLifecycle(item)) as IDBRequest<IDBValidKey>);
    }
    await transactionDone(transaction);
  }

  async deleteItem(id: string): Promise<void> {
    const database = await this.getDb();
    const transaction = database.transaction(ITEMS_STORE, "readwrite");
    await requestToPromise(transaction.objectStore(ITEMS_STORE).delete(id) as IDBRequest<undefined>);
    await transactionDone(transaction);
  }

  async clearItems(): Promise<void> {
    const database = await this.getDb();
    const transaction = database.transaction(ITEMS_STORE, "readwrite");
    await requestToPromise(transaction.objectStore(ITEMS_STORE).clear() as IDBRequest<undefined>);
    await transactionDone(transaction);
  }

  async getSettings(): Promise<AppSettings | undefined> {
    const database = await this.getDb();
    const transaction = database.transaction(META_STORE, "readonly");
    const settings = await requestToPromise(transaction.objectStore(META_STORE).get(SETTINGS_KEY) as IDBRequest<AppSettings | undefined>);
    await transactionDone(transaction);
    return settings;
  }

  async putSettings(settings: AppSettings): Promise<void> {
    const database = await this.getDb();
    const transaction = database.transaction(META_STORE, "readwrite");
    await requestToPromise(transaction.objectStore(META_STORE).put(settings, SETTINGS_KEY) as IDBRequest<IDBValidKey>);
    await transactionDone(transaction);
  }

  async putFile(id: string, blob: Blob): Promise<void> {
    assertSafeStoredFileId(id);
    const database = await this.getDb();
    const transaction = database.transaction(FILES_STORE, "readwrite");
    await requestToPromise(transaction.objectStore(FILES_STORE).put(blob, id) as IDBRequest<IDBValidKey>);
    await transactionDone(transaction);
  }

  async getFile(id: string): Promise<Blob | undefined> {
    assertSafeStoredFileId(id);
    const database = await this.getDb();
    const transaction = database.transaction(FILES_STORE, "readonly");
    const blob = await requestToPromise(transaction.objectStore(FILES_STORE).get(id) as IDBRequest<Blob | undefined>);
    await transactionDone(transaction);
    return blob;
  }

  async getAllFiles(): Promise<{ id: string; blob: Blob }[]> {
    const database = await this.getDb();
    const transaction = database.transaction(FILES_STORE, "readonly");
    const store = transaction.objectStore(FILES_STORE);
    const keys = await requestToPromise(store.getAllKeys() as IDBRequest<IDBValidKey[]>);
    const values = await requestToPromise(store.getAll() as IDBRequest<Blob[]>);
    await transactionDone(transaction);
    const results: { id: string; blob: Blob }[] = [];
    keys.forEach((key, index) => {
      const id = String(key);
      const validation = validateStoredFileId(id);
      if (!validation.valid) return;
      const blob = values[index];
      if (blob) results.push({ id, blob });
    });
    return results;
  }

  async deleteFile(id: string): Promise<void> {
    assertSafeStoredFileId(id);
    const database = await this.getDb();
    const transaction = database.transaction(FILES_STORE, "readwrite");
    await requestToPromise(transaction.objectStore(FILES_STORE).delete(id) as IDBRequest<undefined>);
    await transactionDone(transaction);
  }

  async clearAll(): Promise<void> {
    const database = await this.getDb();
    const transaction = database.transaction([ITEMS_STORE, META_STORE, FILES_STORE], "readwrite");
    await Promise.all([
      requestToPromise(transaction.objectStore(ITEMS_STORE).clear() as IDBRequest<undefined>),
      requestToPromise(transaction.objectStore(META_STORE).clear() as IDBRequest<undefined>),
      requestToPromise(transaction.objectStore(FILES_STORE).clear() as IDBRequest<undefined>),
    ]);
    await transactionDone(transaction);
  }
}

export const storage: StorageAdapter = new IndexedDBAdapter();
