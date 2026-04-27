import JSZip from "jszip";
import { beforeEach, describe, expect, it } from "vitest";
import {
  importVaultExportZip,
  importVaultStructuredSnapshot,
  type VaultStructuredSnapshot,
} from "@/lib/migration/vault-source";
import { buildNamespacedId } from "@/lib/migration/shape";
import { db } from "@/lib/db/db";
import {
  createField,
  createRecord,
  ensureRequiredWorkspaceStructure,
  getRecordPropertyValue,
  listAttachments,
  setRecordValue,
} from "@/lib/storage";
import { resetUnifiedDb } from "@/test/db";

describe("vault migration", () => {
  beforeEach(async () => {
    await resetUnifiedDb();
    await ensureRequiredWorkspaceStructure();
  });

  it("imports structured vault data into the unified schema and keeps reruns idempotent", async () => {
    const timestamp = "2026-04-25T09:00:00.000Z";
    const snapshot: VaultStructuredSnapshot = {
      accounts: [
        {
          id: "acct-1",
          name: "Maybank Visa",
          type: "Credit Card",
          currency: "MYR",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      transactions: [
        {
          id: "txn-1",
          accountId: "acct-1",
          date: "2026-04-25",
          timestamp,
          amountMinor: 12345,
          currency: "MYR",
          type: "posted",
          category: "Groceries",
          description: "Jaya Grocer",
          createdAt: timestamp,
          updatedAt: timestamp,
          attachments: [
            {
              originalName: "receipt.pdf",
              mimeType: "application/pdf",
              sizeBytes: 5,
              dataBase64: "SGVsbG8=",
              sha256: "hash-1",
              createdAt: timestamp,
            },
          ],
        },
      ],
      reminders: [
        {
          id: "rem-1",
          title: "Renew passport",
          dueDate: "2026-06-01",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      identities: [
        {
          id: "identity-1",
          name: "Passport",
          email: "person@example.com",
          phone: "+6000000000",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      services: [
        {
          id: "service-1",
          name: "Immigration Portal",
          category: "Government",
          notes: "Renew annually.",
        },
      ],
      connections: [
        {
          id: "conn-1",
          identityId: "identity-1",
          serviceId: "service-1",
          username: "vault-user",
          email: "person@example.com",
          status: "active",
          notes: "MFA enabled.",
        },
      ],
    };

    const manifest = await importVaultStructuredSnapshot(snapshot);

    expect(manifest.status).toBe("completed");
    expect(manifest.counts.databases).toBe(6);
    expect(manifest.counts.records).toBe(5);
    expect(manifest.counts.attachments).toBe(1);

    const paymentMethod = await db.records.get(buildNamespacedId("vault", "account", "acct-1"));
    expect(paymentMethod?.type).toBe("payment_method");
    expect(paymentMethod?.isSensitive).toBe(true);
    expect(paymentMethod?.properties).not.toHaveProperty("cvv");

    const receiptId = buildNamespacedId("vault", "transaction", "txn-1");
    const attachments = await listAttachments(receiptId);
    expect(attachments).toHaveLength(1);
    expect(attachments[0]?.mimeType).toBe("application/pdf");

    const identity = await db.records.get(buildNamespacedId("vault", "identity", "identity-1"));
    expect(identity?.isSensitive).toBe(true);

    const rerun = await importVaultStructuredSnapshot(snapshot);
    expect(rerun.completedAt).toBe(manifest.completedAt);
    expect(await db.records.where("source").equals("vault").count()).toBe(5);
  });

  it("imports the supported Vault ZIP export format with receipt attachments", async () => {
    const zip = new JSZip();
    zip.file(
      "vault.csv",
      [
        "record_type,transaction_id,account,date,timestamp,amount_minor,currency,type,category,description,attachment_hash,ext,mime,attachment_index",
        "TXN,txn-zip,card-1,2026-04-26,2026-04-26T08:30:00.000Z,999,MYR,posted,Travel,Train ticket,,,,",
        "ATTACHMENT,txn-zip,,,,,,,,,hash123,pdf,application/pdf,0",
      ].join("\n"),
    );
    zip.file("attachments/0__hash123.pdf", "ticket pdf");

    const blob = await zip.generateAsync({ type: "blob" });
    const manifest = await importVaultExportZip(
      new File([blob], "vault-export.zip", { type: "application/zip" }),
    );

    expect(manifest.status).toBe("completed");
    expect(manifest.counts.records).toBe(1);
    expect(manifest.counts.attachments).toBe(1);

    const receiptId = buildNamespacedId("vault", "transaction", "txn-zip");
    const receipt = await db.records.get(receiptId);
    expect(receipt?.title).toBe("Train ticket");

    const attachments = await listAttachments(receiptId);
    expect(attachments).toHaveLength(1);
    expect(attachments[0]?.name).toContain("hash123.pdf");
  });

  it("does not persist unsafe payment method secrets", async () => {
    const workspace = (await db.workspaces.toArray()).find((candidate) => candidate.name === "The Vault");
    expect(workspace).toBeTruthy();
    const paymentMethods = (await db.tablesStore.where({ workspaceId: workspace!.id }).toArray()).find(
      (candidate) => candidate.name === "Payment Methods",
    );
    expect(paymentMethods).toBeTruthy();

    const fullCardField = await createField(paymentMethods!.id, "Full card number", "text");
    const cvvField = await createField(paymentMethods!.id, "CVV", "text");
    const lastFourField = (await db.fields.where({ tableId: paymentMethods!.id }).toArray()).find(
      (field) => field.key === "last_four",
    );
    expect(lastFourField).toBeTruthy();

    const record = await createRecord(paymentMethods!.id, "Maybank Visa");
    await setRecordValue(record.id, fullCardField.id, "4111111111111111");
    await setRecordValue(record.id, cvvField.id, "123");
    await setRecordValue(record.id, lastFourField!.id, "1234");

    const saved = await db.records.get(record.id);
    expect(saved?.isSensitive).toBe(true);
    expect(getRecordPropertyValue(saved!, fullCardField)).toBeUndefined();
    expect(getRecordPropertyValue(saved!, cvvField)).toBeUndefined();
    expect(getRecordPropertyValue(saved!, lastFourField!)).toBe("1234");
  });
});
