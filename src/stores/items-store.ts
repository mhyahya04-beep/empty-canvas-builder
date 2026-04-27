import { create } from "zustand";
import {
  ContentItemSchema,
  coerceLegacyContentItem,
  itemIsArchived,
  normalizeItemLifecycle,
  setItemArchived,
  type ContentItem,
} from "@/models/item";
import { toast } from "sonner";
import { getActiveStorage } from "@/lib/storage/active-storage";
import { buildSeedItems } from "@/data/seed";
import { nowIso } from "@/lib/utils/dates";
import { generateId } from "@/lib/utils/ids";
import { slugify } from "@/lib/utils/slug";

interface ItemsState {
  items: ContentItem[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  upsert: (item: ContentItem) => Promise<void>;
  remove: (id: string) => Promise<void>;
  togglePinned: (id: string) => Promise<void>;
  setArchived: (id: string, archived: boolean) => Promise<void>;
  replaceAll: (items: ContentItem[]) => Promise<void>;
  mergeImported: (items: ContentItem[]) => Promise<void>;
  duplicate: (id: string) => Promise<ContentItem | null>;
}

let hydratePromise: Promise<void> | null = null;

export const useItemsStore = create<ItemsState>((set, get) => ({
  items: [],
  hydrated: false,

  async hydrate() {
    if (get().hydrated) return;
    if (hydratePromise) {
      return hydratePromise;
    }

    hydratePromise = (async () => {
      try {
        const storage = await getActiveStorage();
        const rawItems = await storage.getAllItems();

        // Validate items, repair lifecycle drift, and filter out unrecoverable records.
        const validItems: ContentItem[] = [];
        const corruptCount = { value: 0 };
        const repairedItems: ContentItem[] = [];

        for (const raw of rawItems) {
          const parsed = ContentItemSchema.safeParse(raw);
          const repaired = coerceLegacyContentItem(raw);

          if (repaired) {
            validItems.push(repaired);

            const rawStatus = (raw as { status?: unknown }).status;
            const rawArchived = (raw as { archived?: unknown }).archived;
            const lifecycleNeedsRepair =
              rawStatus !== repaired.status || rawArchived !== repaired.archived;

            if (!parsed.success || lifecycleNeedsRepair) {
              repairedItems.push(repaired);
            }
          } else {
            corruptCount.value++;
            if (!parsed.success) {
              console.warn("Skipping corrupt item:", raw, parsed.error.format());
            } else {
              console.warn("Skipping unrecoverable item:", raw);
            }
          }
        }

        let finalItems = validItems;
        if (finalItems.length === 0 && corruptCount.value === 0) {
          finalItems = buildSeedItems();
          await storage.putItems(finalItems);
        } else if (corruptCount.value > 0) {
          toast.error(
            `${corruptCount.value} corrupt items were skipped. Check console for details.`,
          );
        }

        if (repairedItems.length > 0) {
          await storage.putItems(repairedItems);
          toast.info(`Recovered ${repairedItems.length} legacy item records.`);
        }

        set({ items: finalItems, hydrated: true });
      } catch (e) {
        console.error("Failed to hydrate items store:", e);
        toast.error("Critical: Failed to load vault data.");
        throw e;
      }
    })().finally(() => {
      hydratePromise = null;
    });

    return hydratePromise;
  },

  async upsert(item) {
    const storage = await getActiveStorage();
    const lifecycleSynced = normalizeItemLifecycle(item);
    const updated = { ...lifecycleSynced, updatedAt: nowIso() };
    await storage.putItem(updated);
    set((state) => ({
      items: state.items.some((i) => i.id === updated.id)
        ? state.items.map((i) => (i.id === updated.id ? updated : i))
        : [...state.items, updated],
    }));
  },

  async remove(id) {
    const storage = await getActiveStorage();
    await storage.deleteItem(id);
    set((state) => ({ items: state.items.filter((i) => i.id !== id) }));
  },

  async togglePinned(id) {
    const item = get().items.find((i) => i.id === id);
    if (!item) return;
    await get().upsert({ ...item, pinned: !item.pinned });
  },

  async setArchived(id, archived) {
    const item = get().items.find((i) => i.id === id);
    if (!item) return;
    await get().upsert(setItemArchived(item, archived));
  },

  async replaceAll(items) {
    const storage = await getActiveStorage();
    const normalizedItems = items.map(normalizeItemLifecycle);
    await storage.clearItems();
    await storage.putItems(normalizedItems);
    set({ items: normalizedItems });
  },

  async mergeImported(imported) {
    const storage = await getActiveStorage();
    const normalizedImported = imported.map(normalizeItemLifecycle);
    await storage.putItems(normalizedImported);
    set((state) => {
      const map = new Map(state.items.map((i) => [i.id, i]));
      for (const i of normalizedImported) map.set(i.id, i);
      return { items: Array.from(map.values()) };
    });
  },

  async duplicate(id) {
    const original = get().items.find((i) => i.id === id);
    if (!original) return null;
    const ts = nowIso();
    const copy: ContentItem = {
      ...original,
      id: generateId(),
      title: `${original.title} (copy)`,
      slug: slugify(`${original.title}-copy`),
      pinned: false,
      status: itemIsArchived(original) ? "draft" : original.status,
      archived: false,
      createdAt: ts,
      updatedAt: ts,
      blocks: original.blocks.map((b) => ({ ...b, id: generateId() })),
    };
    const storage = await getActiveStorage();
    await storage.putItem(copy);
    set((state) => ({ items: [...state.items, copy] }));
    return copy;
  },
}));
