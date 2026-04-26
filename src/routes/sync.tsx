import { Route as RootRoute } from '@/routes/__root';
import { AppShell } from '@/components/app-shell';

export const Route = new RootRoute({
  id: '/sync',
  path: '/sync',
  component: () => {
    return (
      <AppShell>
        <div className="p-6 max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">Export & Sync</h1>
          <p className="mb-4 text-muted-foreground">Export your vault or connect cloud storage providers.</p>
          <div className="space-y-4">
            <div className="p-4 border border-border bg-card rounded">
              <h3 className="font-semibold">Export</h3>
              <p className="text-xs text-muted-foreground">Download a JSON export of your workspace.</p>
              <div className="mt-2"><button className="btn">Export JSON</button></div>
            </div>
            <div className="p-4 border border-border bg-card rounded">
              <h3 className="font-semibold">Cloud Sync</h3>
              <p className="text-xs text-muted-foreground">Connect Google Drive or other providers (coming soon).</p>
            </div>
          </div>
        </div>
      </AppShell>
    );
  },
});
