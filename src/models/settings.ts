import { z } from "zod";

export const ThemeModeSchema = z.enum(["light", "dark", "sepia", "midnight"]);
export const StorageModeSchema = z.enum(["local_only", "google_drive"]);

export const AppSettingsSchema = z.object({
  theme: ThemeModeSchema,
  storageMode: StorageModeSchema,
  recentItemIds: z.array(z.string()),
  seededAt: z.string().optional(),
  lastSyncAt: z.string().optional(),
});

export type ThemeMode = z.infer<typeof ThemeModeSchema>;
export type StorageMode = z.infer<typeof StorageModeSchema>;
export type AppSettings = z.infer<typeof AppSettingsSchema>;

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "light",
  storageMode: "local_only",
  recentItemIds: [],
};
