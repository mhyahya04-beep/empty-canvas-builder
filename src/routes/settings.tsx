import { Route as TanStackRoute } from '@tanstack/react-router';
import { AppShell } from '@/components/app-shell';

export const Route = new TanStackRoute({
  path: '/settings',
  component: () => {
    return (
      <AppShell>
        <div className="p-6 max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">Settings</h1>
          <p className="mb-4 text-muted-foreground">Manage application preferences, themes, and integrations.</p>
          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold">Appearance</h3>
              <p className="text-xs text-muted-foreground">Light / Dark theme and typography.</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold">Storage & Sync</h3>
              <p className="text-xs text-muted-foreground">Choose where to store your vault (IndexedDB, Tauri FS, Drive).</p>
            </div>
          </section>
        </div>
      </AppShell>
    );
  },
} as any);
