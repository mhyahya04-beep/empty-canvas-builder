import React, { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { setTheme } from "@/lib/use-theme";

export function ThemeToggle() {
  const [theme, setThemeState] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = typeof window !== "undefined" ? (localStorage.getItem("theme") as "light" | "dark" | null) : null;
    const prefersDark = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const t = saved ?? (prefersDark ? "dark" : "light");
    setThemeState(t as any);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setThemeState(next);
  };

  return (
    <button aria-label="Toggle theme" title="Toggle theme" onClick={toggle} className="p-1.5 rounded hover:bg-muted text-muted-foreground">
      <Sun className={`w-4 h-4 ${theme === "light" ? "block" : "hidden"}`} />
      <Moon className={`w-4 h-4 ${theme === "dark" ? "block" : "hidden"}`} />
    </button>
  );
}
