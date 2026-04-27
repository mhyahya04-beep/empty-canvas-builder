const SAFE_WEB_PROTOCOLS = new Set(["http:", "https:"]);
const SAFE_LOCAL_OBJECT_PROTOCOLS = new Set(["blob:"]);
const CSS_COLOR_KEYWORD = /^[a-zA-Z][a-zA-Z0-9-]{0,31}$/;
const CSS_CUSTOM_PROPERTY_REFERENCE = /^var\(--[A-Za-z0-9_-]{1,64}\)$/;
const CSS_HEX_COLOR = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const CSS_RGB_COLOR =
  /^rgba?\(\s*(?:\d{1,3}%?\s*,\s*){2}\d{1,3}%?(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/;
const CSS_HSL_COLOR =
  /^hsla?\(\s*\d{1,3}(?:deg)?\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/;

export function safeParseWebUrl(value: string): URL | null {
  try {
    const parsed = new URL(value.trim());
    return SAFE_WEB_PROTOCOLS.has(parsed.protocol) ? parsed : null;
  } catch {
    return null;
  }
}

export function isSafeWebUrl(value: string): boolean {
  return safeParseWebUrl(value) !== null;
}

export function toSafeWebHref(value: string): string | null {
  const parsed = safeParseWebUrl(value);
  return parsed?.href ?? null;
}

export function toSafeImageSrc(value: string): string | null {
  return toSafeWebHref(value);
}

export function toSafeLocalAssetUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const runtimeOrigin =
    typeof window !== "undefined" && window.location ? window.location.origin : null;

  try {
    const parsed = runtimeOrigin
      ? new URL(trimmed, window.location.href)
      : trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")
        ? new URL(trimmed, "http://local.invalid/")
        : new URL(trimmed);

    if (parsed.protocol === "asset:" || parsed.protocol === "tauri:") {
      return parsed.href;
    }

    if (runtimeOrigin) {
      return parsed.origin === runtimeOrigin ? parsed.href : null;
    }

    return parsed.origin === "http://local.invalid" ? parsed.pathname : null;
  } catch {
    return null;
  }
}

export function isSafeObjectUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return SAFE_LOCAL_OBJECT_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

export function formatSafeUrlHost(value: string): string {
  const parsed = safeParseWebUrl(value);
  return parsed ? parsed.hostname.replace(/^www\./, "") : "Blocked unsafe URL";
}

export function sanitizeCssCustomPropertyName(value: string): string | null {
  const trimmed = value.trim();
  return /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(trimmed) ? trimmed : null;
}

export function sanitizeCssColor(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (
    CSS_HEX_COLOR.test(trimmed) ||
    CSS_RGB_COLOR.test(trimmed) ||
    CSS_HSL_COLOR.test(trimmed) ||
    CSS_CUSTOM_PROPERTY_REFERENCE.test(trimmed) ||
    CSS_COLOR_KEYWORD.test(trimmed)
  ) {
    return trimmed;
  }

  return null;
}
