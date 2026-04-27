import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = (createFileRoute as any)("/subjects/$subjectId")({
  component: LegacySubjectRoute,
});

function LegacySubjectRoute() {
  return (
    <AppShell>
      <div className="mx-auto flex h-full max-w-3xl flex-1 flex-col items-center justify-center px-8 py-16 text-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Legacy Subject Routes Were Retired</h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Subject and topic pages from the old study-vault system were migrated into the unified workspaces.
          Use the Personal Knowledge Vault or General Notes workspaces to continue editing those records.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Return Home
        </Link>
      </div>
    </AppShell>
  );
}
