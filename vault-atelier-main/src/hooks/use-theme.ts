import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { getSettings, updateSettings } from "@/lib/storage";
import type { ThemeFamily, ThemeMode } from "@/lib/types";

const FAMILY_KEY = "vault.themeFamily";
const MODE_KEY = "vault.themeMode";
const SERIF_KEY = "vault.serif";
const COMPACT_KEY = "vault.compact";

function resolveMode(mode: ThemeMode): "dark" | "light" {
  if (mode === "system") {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

export function applyTheme(family: ThemeFamily, mode: ThemeMode, serif: boolean, compact: boolean) {
  if (typeof document === "undefined") return;
  const resolved = resolveMode(mode);
  const root = document.documentElement;
  root.setAttribute("data-theme-family", family);
  root.setAttribute("data-theme-mode", resolved);
  root.setAttribute("data-serif", serif ? "1" : "0");
  root.setAttribute("data-compact", compact ? "1" : "0");
  if (resolved === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  try {
    localStorage.setItem(FAMILY_KEY, family);
    localStorage.setItem(MODE_KEY, mode);
    localStorage.setItem(SERIF_KEY, serif ? "1" : "0");
    localStorage.setItem(COMPACT_KEY, compact ? "1" : "0");
  } catch { /* ignore */ }
}

function readLocal(key: string, fallback: string): string {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}

export function useTheme() {
  const [family, setFamily] = useState<ThemeFamily>(() => readLocal(FAMILY_KEY, "obsidianAtelier") as ThemeFamily);
  const [mode, setMode] = useState<ThemeMode>(() => readLocal(MODE_KEY, "dark") as ThemeMode);
  const [serif, setSerif] = useState<boolean>(() => readLocal(SERIF_KEY, "1") !== "0");
  const [compact, setCompact] = useState<boolean>(() => readLocal(COMPACT_KEY, "0") === "1");

  // Apply on every change
  useEffect(() => { applyTheme(family, mode, serif, compact); }, [family, mode, serif, compact]);

  // Persist to settings
  useEffect(() => {
    if (!db.isOpen()) return;
    updateSettings({ themeFamily: family, themeMode: mode, serifHeadings: serif, compactMode: compact, theme: family }).catch(() => {});
  }, [family, mode, serif, compact]);

  // Hydrate from settings on mount (so backup-restored theme wins)
  useEffect(() => {
    getSettings().then((s) => {
      const f = (s.themeFamily ?? s.theme) as ThemeFamily;
      if (f && f !== family) setFamily(f);
      if (s.themeMode && s.themeMode !== mode) setMode(s.themeMode);
      if (typeof s.serifHeadings === "boolean" && s.serifHeadings !== serif) setSerif(s.serifHeadings);
      if (typeof s.compactMode === "boolean" && s.compactMode !== compact) setCompact(s.compactMode);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to system color scheme changes when on "system"
  useEffect(() => {
    if (mode !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const fn = () => applyTheme(family, mode, serif, compact);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [mode, family, serif, compact]);

  return {
    family, setFamily,
    mode, setMode,
    serif, setSerif,
    compact, setCompact,
  };
}
