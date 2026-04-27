
import { GoogleDriveProvider } from "./google-drive-provider";

/**
 * Singleton instance for the Google Drive Sync service
 */
export const googleDriveSync = new GoogleDriveProvider();

export * from "./types";
export * from "./google-drive-adapter";
export * from "./google-drive-provider";
