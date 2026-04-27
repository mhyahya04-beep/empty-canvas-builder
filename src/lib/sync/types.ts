
export type SyncStatus = 'idle' | 'syncing' | 'error';

export interface SyncState {
  status: SyncStatus;
  lastSyncAt?: string;
  error?: string;
  progress?: number; // 0 to 1
}

export interface SyncProvider {
  /**
   * Pushes local data to the remote storage.
   * This includes the app-data.json, readable archive (DOCX), and attachments.
   */
  pushToDrive(): Promise<void>;

  /**
   * Pulls data from the remote storage and updates local DB.
   */
  pullFromDrive(): Promise<void>;

  /**
   * Compares local state with remote state to see what needs to be updated.
   * Returns true if there are changes to sync.
   */
  detectChanges(): Promise<boolean>;

  /**
   * Current sync state
   */
  getState(): SyncState;

  /**
   * Sets up or updates credentials/auth for the provider
   */
  authorize(token: string): void;
}

export interface SyncMetadata {
  version: string;
  lastUpdated: string;
  device: string;
}
