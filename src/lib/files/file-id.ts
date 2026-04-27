const SAFE_FILE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

export interface FileIdValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateStoredFileId(id: string): FileIdValidationResult {
  if (typeof id !== "string") {
    return { valid: false, reason: "File ID must be a string." };
  }

  if (id.length === 0) {
    return { valid: false, reason: "File ID cannot be empty." };
  }

  if (id !== id.trim()) {
    return { valid: false, reason: "File ID cannot contain leading or trailing whitespace." };
  }

  if (!SAFE_FILE_ID_PATTERN.test(id)) {
    return {
      valid: false,
      reason: "File ID may contain only ASCII letters, numbers, dots, underscores, and hyphens.",
    };
  }

  if (id === "." || id === ".." || id.includes("..")) {
    return { valid: false, reason: "File ID cannot contain traversal segments." };
  }

  if (WINDOWS_RESERVED_NAMES.test(id)) {
    return { valid: false, reason: "File ID cannot use a reserved Windows device name." };
  }

  return { valid: true };
}

export function assertSafeStoredFileId(id: string): void {
  const result = validateStoredFileId(id);
  if (!result.valid) {
    throw new Error(`Unsafe stored file ID "${id}": ${result.reason}`);
  }
}

export function assertPathInsideDirectory(targetPath: string, directoryPath: string): void {
  const target = normalizeForContainment(targetPath);
  const directory = normalizeForContainment(directoryPath);
  const directoryPrefix = directory.endsWith("/") ? directory : `${directory}/`;

  if (!target.startsWith(directoryPrefix)) {
    throw new Error("Resolved file path escaped the vault files directory.");
  }
}

function normalizeForContainment(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/u, "");
}
