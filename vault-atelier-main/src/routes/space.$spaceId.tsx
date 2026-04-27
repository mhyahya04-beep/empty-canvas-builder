import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Workspace } from "@/components/workspace";
import { useEffect } from "react";
import { updateSettings } from "@/lib/storage";

export const Route = createFileRoute("/space/$spaceId")({
  validateSearch: (s: Record<string, unknown>): { record?: string } => ({
    record: typeof s.record === "string" ? s.record : undefined,
  }),
  component: SpacePage,
});

function SpacePage() {
  const { spaceId } = Route.useParams();
  useEffect(() => { updateSettings({ lastOpenedSpaceId: spaceId }).catch(() => {}); }, [spaceId]);
  return (
    <AppShell>
      <Workspace spaceId={spaceId} />
    </AppShell>
  );
}
