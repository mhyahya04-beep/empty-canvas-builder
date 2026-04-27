import type { SyncProvider, SyncStatus } from "./sync-provider";

export const localOnlyProvider: SyncProvider = {
  id: "local_only",
  label: "Local only",
  isAvailable: () => true,
  pull: async () => {},
  push: async () => {},
  getStatus: (): SyncStatus => "idle",
  getLastSyncAt: () => null,
};
