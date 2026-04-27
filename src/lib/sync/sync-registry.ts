import type { SyncProvider } from "./sync-provider";
import { localOnlyProvider } from "./local-only-provider";
import { googleDriveProvider } from "./google-drive-provider";

export const syncProviders: Record<SyncProvider["id"], SyncProvider> = {
  local_only: localOnlyProvider,
  google_drive: googleDriveProvider,
};

export function getSyncProvider(id: SyncProvider["id"]): SyncProvider {
  return syncProviders[id] ?? localOnlyProvider;
}
