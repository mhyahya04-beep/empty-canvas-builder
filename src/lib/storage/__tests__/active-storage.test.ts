import { afterEach, describe, expect, it, vi } from "vitest";
import type { StorageAdapter } from "../storage-adapter";

function createAdapter(): StorageAdapter {
  return {
    init: async () => {},
    getAllItems: async () => [],
    getItem: async () => undefined,
    putItem: async () => {},
    putItems: async () => {},
    deleteItem: async () => {},
    clearItems: async () => {},
    getSettings: async () => undefined,
    putSettings: async () => {},
    putFile: async () => {},
    getFile: async () => undefined,
    getAllFiles: async () => [],
    deleteFile: async () => {},
    clearAll: async () => {},
  };
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.doUnmock("../storage-manager");
});

describe("getActiveStorage", () => {
  it("deduplicates concurrent initialization", async () => {
    const adapter = createAdapter();
    const getStorageAdapter = vi.fn(async () => adapter);

    vi.doMock("../storage-manager", () => ({ getStorageAdapter }));

    const { getActiveStorage } = await import("../active-storage");
    const [first, second] = await Promise.all([getActiveStorage(), getActiveStorage()]);

    expect(first).toBe(adapter);
    expect(second).toBe(adapter);
    expect(getStorageAdapter).toHaveBeenCalledTimes(1);
  });

  it("retries after a failed initialization attempt", async () => {
    const adapter = createAdapter();
    const getStorageAdapter = vi
      .fn<() => Promise<StorageAdapter>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(adapter);

    vi.doMock("../storage-manager", () => ({ getStorageAdapter }));

    const { getActiveStorage } = await import("../active-storage");

    await expect(getActiveStorage()).rejects.toThrow("boom");
    await expect(getActiveStorage()).resolves.toBe(adapter);
    expect(getStorageAdapter).toHaveBeenCalledTimes(2);
  });
});
