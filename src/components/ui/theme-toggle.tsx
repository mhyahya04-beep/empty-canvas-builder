import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";

export function ThemeToggle() {
  const { mode, setMode } = useTheme();

  const toggle = () => {
    setMode(mode === "dark" ? "light" : "dark");
  };

  return (
    <button aria-label="Toggle theme" title="Toggle theme" onClick={toggle} className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors">
      <Sun className={`w-4 h-4 ${mode === "light" ? "block" : "hidden"}`} />
      <Moon className={`w-4 h-4 ${mode === "dark" ? "block" : "hidden"}`} />
    </button>
  );
}
