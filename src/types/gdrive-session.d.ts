export interface GDriveSession {
  accessToken?: string;
  accessTokenExpires?: number | null;
  refreshToken?: string | null;
  error?: string | null;
  email?: string | null;
}

export {};
