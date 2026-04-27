import { create } from "zustand";
import {
  AppSettingsSchema,
  type AppSettings,
  type ThemeMode,
  type StorageMode,
} from "@/models/settings";
import { DEFAULT_SETTINGS } from "@/models/settings";
import { getActiveStorage } from "@/lib/storage/active-storage";

interface SettingsState {
  settings: AppSettings;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setTheme: (theme: ThemeMode) => Promise<void>;
  setStorageMode: (mode: StorageMode) => Promise<void>;
  pushRecent: (itemId: string) => Promise<void>;
}

let hydratePromise: Promise<void> | null = null;

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  hydrated: false,

  async hydrate() {
    if (get().hydrated) return;
    if (hydratePromise) {
      return hydratePromise;
    }

    hydratePromise = (async () => {
      const storage = await getActiveStorage();
      const existing = await storage.getSettings();
      let settings = DEFAULT_SETTINGS;

      if (existing) {
        const result = AppSettingsSchema.safeParse(existing);
        if (result.success) {
          settings = result.data;
        } else {
          console.warn("Corrupt settings found, falling back to defaults", result.error.format());
          await storage.putSettings(DEFAULT_SETTINGS);
        }
      } else {
        await storage.putSettings(DEFAULT_SETTINGS);
      }

      applyTheme(settings.theme);
      set({ settings, hydrated: true });
    })().finally(() => {
      hydratePromise = null;
    });

    return hydratePromise;
  },

  async setTheme(theme) {
    const storage = await getActiveStorage();
    const next = { ...get().settings, theme };
    await storage.putSettings(next);
    applyTheme(theme);
    set((state) => ({ settings: { ...state.settings, theme } }));
  },

  async setStorageMode(storageMode) {
    const storage = await getActiveStorage();
    const next = { ...get().settings, storageMode };
    await storage.putSettings(next);
    set((state) => ({ settings: { ...state.settings, storageMode } }));
  },

  async pushRecent(itemId) {
    const storage = await getActiveStorage();
    const currentRecent = get().settings.recentItemIds;
    const recent = [itemId, ...currentRecent.filter((id) => id !== itemId)].slice(0, 12);
    const next = { ...get().settings, recentItemIds: recent };
    await storage.putSettings(next);
    set((state) => {
      const updatedRecent = [
        itemId,
        ...state.settings.recentItemIds.filter((id) => id !== itemId),
      ].slice(0, 12);
      return { settings: { ...state.settings, recentItemIds: updatedRecent } };
    });
  },
}));

function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("dark", "theme-sepia", "theme-midnight");
  if (theme === "dark") root.classList.add("dark");
  else if (theme === "sepia") root.classList.add("theme-sepia");
  else if (theme === "midnight") root.classList.add("dark", "theme-midnight");
}
