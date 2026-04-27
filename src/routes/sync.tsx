import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/sync")({
  component: SyncRoute,
});

function SyncRoute() {
  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="mb-4 text-3xl font-display font-semibold tracking-tight">Backup & Migration</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Cloud sync placeholders were removed during the unified vault migration. Use the live backup/export tools from the sidebar to export the current vault or import verified migration bundles.
        </p>
        <div className="mt-8 rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          <p>The supported flow is:</p>
          <p className="mt-2 font-medium text-foreground">Sidebar → Backup & Migration → Export / Import</p>
        </div>
        <Link to="/" className="mt-6 inline-flex items-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Return Home
        </Link>
      </div>
    </AppShell>
  );
}
