import { beforeEach, describe, expect, it } from "vitest";
import { db, now, uid } from "@/lib/db/db";
import { refreshUrgentIndex } from "@/lib/urgent";
import { ensureRequiredWorkspaceStructure, upsertPreparedRecord } from "@/lib/storage";
import { resetUnifiedDb } from "@/test/db";

function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

describe("urgent index", () => {
  beforeEach(async () => {
    await resetUnifiedDb();
    await ensureRequiredWorkspaceStructure();
  });

  it("indexes identity expiries within the long-horizon urgent window", async () => {
    const workspace = (await db.workspaces.toArray()).find((candidate) => candidate.name === "The Vault");
    expect(workspace).toBeTruthy();
    const identity = (await db.tablesStore.where({ workspaceId: workspace!.id }).toArray()).find(
      (candidate) => candidate.name === "Identity",
    );
    expect(identity).toBeTruthy();

    const timestamp = now();
    const record = await upsertPreparedRecord({
      id: uid(),
      workspaceId: identity!.workspaceId,
      databaseId: identity!.id,
      tableId: identity!.id,
      title: "Passport",
      type: "identity",
      properties: {
        expiry_date: daysFromNow(60),
      },
      fields: {},
      blocks: [],
      attachments: [],
      tags: [],
      isUrgent: false,
      isSensitive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const items = await refreshUrgentIndex();
    const expiryItem = items.find((item) => item.sourceRef.recordId === record.id && item.sourceType === "deadline");
    expect(expiryItem?.message).toContain("Expiry Date");
    expect(expiryItem?.isSensitive).toBe(true);
    expect(await db.urgentItems.count()).toBe(items.length);
  });
});
