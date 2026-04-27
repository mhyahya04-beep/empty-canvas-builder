import { getActiveStorage } from "@/lib/storage/active-storage";

/**
 * Thin helper around the storage adapter for binary file attachments.
 */
export const fileStore = {
  async save(id: string, blob: Blob) {
    const storage = await getActiveStorage();
    await storage.putFile(id, blob);
  },
  async load(id: string): Promise<Blob | undefined> {
    const storage = await getActiveStorage();
    return storage.getFile(id);
  },
  async remove(id: string) {
    const storage = await getActiveStorage();
    await storage.deleteFile(id);
  },
  async toUrl(id: string): Promise<string | null> {
    const storage = await getActiveStorage();
    const blob = await storage.getFile(id);
    if (!blob) return null;
    return URL.createObjectURL(blob);
  },
};
