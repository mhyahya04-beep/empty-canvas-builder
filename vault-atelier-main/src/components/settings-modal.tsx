import { Modal } from "./modal";
import { useTheme } from "@/hooks/use-theme";
import type { ThemeFamily, ThemeMode } from "@/lib/types";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const FAMILIES: { key: ThemeFamily; name: string; description: string; swatch: string[] }[] = [
  { key: "obsidianAtelier", name: "Obsidian Atelier", description: "Dark charcoal & champagne — the default.", swatch: ["#1f1d1a", "#2b2926", "#d9c084"] },
  { key: "pearlDesk", name: "Pearl Desk", description: "Warm ivory, soft academic.", swatch: ["#f6f1e6", "#e9dec8", "#8a6a3a"] },
  { key: "coquetteArchive", name: "Coquette Archive", description: "Blush, cream, ribbon pink.", swatch: ["#f8e6e8", "#f1cdd2", "#c4708a"] },
  { key: "clinicalScholar", name: "Clinical Scholar", description: "Clean professional, medical.", swatch: ["#f3f7fb", "#dbe7f2", "#2b6cb0"] },
  { key: "libraryNoir", name: "Library Noir", description: "Walnut, parchment, antique gold.", swatch: ["#1d1610", "#3a2e22", "#c9a25a"] },
  { key: "pastelGlass", name: "Pastel Glass", description: "Smoky lavender, frosted glass.", swatch: ["#2a2435", "#3b3548", "#a59bd2"] },
];

const MODES: { key: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { key: "dark", label: "Dark", icon: <Moon className="w-3.5 h-3.5" /> },
  { key: "light", label: "Light", icon: <Sun className="w-3.5 h-3.5" /> },
  { key: "system", label: "System", icon: <Monitor className="w-3.5 h-3.5" /> },
];

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { family, setFamily, mode, setMode, serif, setSerif, compact, setCompact } = useTheme();

  return (
    <Modal open={open} onClose={onClose} title="Settings" maxWidth="max-w-2xl">
      <div className="space-y-6">
        {/* Mode toggle */}
        <div>
          <h3 className="text-sm font-semibold mb-3 text-foreground">Appearance</h3>
          <div className="inline-flex items-center bg-muted/40 border border-border rounded-lg p-0.5">
            {MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  mode === m.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Theme family grid */}
        <div>
          <h3 className="text-sm font-semibold mb-3 text-foreground">Theme</h3>
          <div className="grid grid-cols-2 gap-3">
            {FAMILIES.map((t) => (
              <button
                key={t.key}
                onClick={() => setFamily(t.key)}
                className={cn(
                  "text-left p-4 rounded-xl border transition-all",
                  family === t.key ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50",
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{t.name}</span>
                  {family === t.key && <Check className="w-4 h-4 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground mb-3">{t.description}</p>
                <div className="flex gap-1">
                  {t.swatch.map((c, i) => (
                    <span key={i} className="w-6 h-6 rounded-md border border-border/50" style={{ background: c }} />
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-2">
          <Toggle label="Serif headings" description="Use elegant serif typography for titles." checked={serif} onChange={setSerif} />
          <Toggle label="Compact mode" description="Tighter spacing for dense data." checked={compact} onChange={setCompact} />
        </div>

        <div className="pt-4 border-t border-border text-xs text-muted-foreground">
          Vault Atelier runs entirely in your browser. No accounts, no servers, no telemetry.
        </div>
      </div>
    </Modal>
  );
}

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-4 p-3 rounded-lg border border-border hover:bg-muted/40 text-left"
    >
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <span className={cn(
        "shrink-0 w-9 h-5 rounded-full transition-colors relative",
        checked ? "bg-primary" : "bg-muted",
      )}>
        <span className={cn(
          "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-card transition-transform",
          checked && "translate-x-4",
        )} />
      </span>
    </button>
  );
}
