import { useCallback, useEffect, useState } from "react";
import { BookOpen, RefreshCcw } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useUIStore } from "@/stores/ui-store";
import { useItemsStore } from "@/stores/items-store";
import { useSettingsStore } from "@/stores/settings-store";
import { getErrorMessage } from "@/lib/utils/errors";

export function AppShell({ children }: { children: React.ReactNode }) {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const hydrateItems = useItemsStore((s) => s.hydrate);
  const hydrated = useItemsStore((s) => s.hydrated);
  const hydrateSettings = useSettingsStore((s) => s.hydrate);
  const settingsHydrated = useSettingsStore((s) => s.hydrated);
  const [error, setError] = useState<string | null>(null);

  const init = useCallback(async () => {
    setError(null);
    try {
      await Promise.all([hydrateItems(), hydrateSettings()]);
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Failed to load local vault data."));
    }
  }, [hydrateItems, hydrateSettings]);

  useEffect(() => {
    void init();
  }, [init]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8 text-center">
        <div className="mb-6 rounded-full bg-destructive/10 p-4">
          <BookOpen className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">Vault Error</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{error}</p>
        <button
          type="button"
          onClick={() => void init()}
          className="mt-8 flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90"
        >
          <RefreshCcw className="h-4 w-4" />
          Try Again
        </button>
      </div>
    );
  }

  if (!hydrated || !settingsHydrated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <div className="relative mb-6">
          <div className="absolute inset-0 animate-ping rounded-full bg-primary/20 opacity-75" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-xl bg-primary shadow-2xl">
            <BookOpen className="h-8 w-8 text-primary-foreground" />
          </div>
        </div>
        <div className="font-serif text-2xl font-bold tracking-tight text-foreground">Scholar</div>
        <p className="mt-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/60">
          Unlocking your vault...
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full animate-in fade-in duration-700 bg-background text-foreground">
      {sidebarOpen && (
        <>
          <button
            type="button"
            aria-label="Close navigation"
            className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-40 w-72 lg:hidden">
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
        </>
      )}
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
