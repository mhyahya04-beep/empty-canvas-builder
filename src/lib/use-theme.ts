import { useEffect } from "react";

export function useTheme() {
  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme");
      const prefersDark = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      const theme = (saved as "dark" | "light" | null) ?? (prefersDark ? "dark" : "light");
      document.documentElement.classList.toggle("theme-dark", theme === "dark");
      document.documentElement.classList.toggle("theme-light", theme === "light");
    } catch (e) {
      // ignore in SSR or restricted environments
    }
  }, []);
}

export function setTheme(theme: "dark" | "light") {
  try {
    localStorage.setItem("theme", theme);
    document.documentElement.classList.toggle("theme-dark", theme === "dark");
    document.documentElement.classList.toggle("theme-light", theme === "light");
  } catch (e) {
    // ignore
  }
}
