import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StorageAdapter } from "@/lib/storage/storage-adapter";
import type { ContentItem } from "@/models/item";
import { DEFAULT_SETTINGS } from "@/models/settings";

function createDeferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((resolver) => {
    resolve = resolver;
  });

  return { promise, resolve };
}

function createStorage(overrides: Partial<StorageAdapter> = {}): StorageAdapter {
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
    ...overrides,
  };
}

function createSeedItem(): ContentItem {
  return {
    id: "seed-item-1",
    type: "note",
    title: "Seeded",
    slug: "seeded",
    subjectId: null,
    parentId: null,
    tags: ["seed"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    status: "draft",
    pinned: false,
    archived: false,
    blocks: [{ id: "block-1", type: "paragraph", text: "hello" }],
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("store hydration deduplication", () => {
  it("deduplicates concurrent item hydration so seeding runs once", async () => {
    const gate = createDeferred();
    const storage = createStorage({
      getAllItems: vi.fn(async () => {
        await gate.promise;
        return [];
      }),
      putItems: vi.fn(async () => {}),
    });

    const getActiveStorage = vi.fn(async () => storage);
    const buildSeedItems = vi.fn(() => [createSeedItem()]);

    vi.doMock("sonner", () => ({
      toast: {
        error: vi.fn(),
        info: vi.fn(),
      },
    }));
    vi.doMock("@/lib/storage/active-storage", () => ({ getActiveStorage }));
    vi.doMock("@/data/seed", () => ({ buildSeedItems }));

    const { useItemsStore } = await import("../items-store");

    const first = useItemsStore.getState().hydrate();
    const second = useItemsStore.getState().hydrate();

    gate.resolve();
    await Promise.all([first, second]);

    expect(getActiveStorage).toHaveBeenCalledTimes(1);
    expect(storage.getAllItems).toHaveBeenCalledTimes(1);
    expect(buildSeedItems).toHaveBeenCalledTimes(1);
    expect(storage.putItems).toHaveBeenCalledTimes(1);
    expect(useItemsStore.getState().hydrated).toBe(true);
    expect(useItemsStore.getState().items).toEqual([createSeedItem()]);
  });

  it("allows item hydration retry after a failed attempt", async () => {
    const failedStorage = createStorage({
      getAllItems: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    const healthyStorage = createStorage({
      getAllItems: vi.fn(async () => []),
      putItems: vi.fn(async () => {}),
    });

    const getActiveStorage = vi
      .fn<() => Promise<StorageAdapter>>()
      .mockResolvedValueOnce(failedStorage)
      .mockResolvedValueOnce(healthyStorage);
    const buildSeedItems = vi.fn(() => [createSeedItem()]);

    vi.doMock("sonner", () => ({
      toast: {
        error: vi.fn(),
        info: vi.fn(),
      },
    }));
    vi.doMock("@/lib/storage/active-storage", () => ({ getActiveStorage }));
    vi.doMock("@/data/seed", () => ({ buildSeedItems }));

    const { useItemsStore } = await import("../items-store");

    await expect(useItemsStore.getState().hydrate()).rejects.toThrow("boom");
    await expect(useItemsStore.getState().hydrate()).resolves.toBeUndefined();

    expect(getActiveStorage).toHaveBeenCalledTimes(2);
    expect(buildSeedItems).toHaveBeenCalledTimes(1);
  });

  it("deduplicates concurrent settings hydration and default writes", async () => {
    const gate = createDeferred();
    const storage = createStorage({
      getSettings: vi.fn(async () => {
        await gate.promise;
        return undefined;
      }),
      putSettings: vi.fn(async () => {}),
    });

    const getActiveStorage = vi.fn(async () => storage);

    vi.doMock("@/lib/storage/active-storage", () => ({ getActiveStorage }));

    const { useSettingsStore } = await import("../settings-store");

    const first = useSettingsStore.getState().hydrate();
    const second = useSettingsStore.getState().hydrate();

    gate.resolve();
    await Promise.all([first, second]);

    expect(getActiveStorage).toHaveBeenCalledTimes(1);
    expect(storage.getSettings).toHaveBeenCalledTimes(1);
    expect(storage.putSettings).toHaveBeenCalledTimes(1);
    expect(storage.putSettings).toHaveBeenCalledWith(DEFAULT_SETTINGS);
    expect(useSettingsStore.getState().hydrated).toBe(true);
    expect(useSettingsStore.getState().settings).toEqual(DEFAULT_SETTINGS);
  });
});
