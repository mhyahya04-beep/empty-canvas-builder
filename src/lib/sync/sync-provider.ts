/**
 * SyncProvider abstracts how local data is mirrored to a remote source.
 * v1 ships LocalOnlyProvider (no-op). Future: GoogleDriveProvider.
 */

export type SyncStatus = "idle" | "syncing" | "error" | "success";

export interface SyncProvider {
  readonly id: "local_only" | "google_drive";
  readonly label: string;
  isAvailable(): boolean;
  pull(): Promise<void>;
  push(): Promise<void>;
  getStatus(): SyncStatus;
  getLastSyncAt(): string | null;
}
