import JSZip from "jszip";
import { db } from "@/lib/db/db";
import {
  getMigrationManifest,
  getFields,
  saveMigrationManifest,
  upsertPreparedRecord,
} from "@/lib/storage";
import type { Attachment, MigrationManifest, RecordItem } from "@/lib/types";
import { buildNamespacedId } from "@/lib/migration/shape";
import { buildSectionedBlocks, paragraphBlock } from "@/lib/migration/document";

export interface VaultAccount {
  id: string;
  name: string;
  type?: string;
  currency?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VaultTransactionAttachment {
  id?: string;
  originalName?: string;
  mimeType: string;
  sizeBytes?: number;
  dataBase64?: string;
  filePath?: string;
  sha256?: string;
  createdAt?: string;
}

export interface VaultTransaction {
  id: string;
  accountId: string;
  date: string;
  timestamp: string;
  amountMinor: number;
  currency: string;
  type: string;
  categoryId?: string;
  category?: string;
  description?: string;
  purpose?: string;
  notes?: string;
  vendor?: string;
  location?: string;
  attachmentPaths?: string[];
  attachments?: VaultTransactionAttachment[];
  createdAt?: string;
  updatedAt?: string;
}

export interface VaultReminder {
  id: string;
  title: string;
  dueDateStart?: string;
  dueDateEnd?: string;
  dueDate?: string;
  amount?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VaultSubscription {
  id: string;
  name: string;
  nextRenewal?: string;
  amount?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VaultInstallment {
  id: string;
  name: string;
  nextDue?: string;
  totalAmount?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VaultBill {
  id: string;
  name: string;
  dueDay?: number;
  amount?: number;
  currency?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VaultIdentity {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VaultService {
  id: string;
  name: string;
  category?: string;
  website?: string;
  notes?: string;
}

export interface VaultConnection {
  id: string;
  serviceId: string;
  identityId: string;
  username?: string;
  email?: string;
  status?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VaultStructuredSnapshot {
  accounts?: VaultAccount[];
  transactions?: VaultTransaction[];
  reminders?: VaultReminder[];
  subscriptions?: VaultSubscription[];
  installments?: VaultInstallment[];
  bills?: VaultBill[];
  identities?: VaultIdentity[];
  services?: VaultService[];
  connections?: VaultConnection[];
}

export interface VaultZipImport {
  receipts: VaultTransaction[];
  attachmentsByTransactionId: Record<string, Attachment[]>;
}

const VAULT_STRUCTURED_MANIFEST_ID = "migration:vault:structured";
const VAULT_ZIP_MANIFEST_ID = "migration:vault:zip";

function bytesToDataUrl(bytes: Uint8Array, mimeType: string): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

function splitCsvLine(line: string): string[] {
  const output: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (character === "," && !inQuotes) {
      output.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  output.push(current);
  return output;
}

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const header = splitCsvLine(lines[0] ?? "");
  return lines.slice(1).map((line) => {
    const columns = splitCsvLine(line);
    return Object.fromEntries(header.map((key, index) => [key, columns[index] ?? ""]));
  });
}

async function resolveVaultDatabase(databaseName: string) {
  const workspace = (await db.workspaces.toArray()).find((candidate) => candidate.name === "The Vault");
  if (!workspace) throw new Error("The Vault workspace is missing");
  const database = (await db.tablesStore.where({ workspaceId: workspace.id }).toArray()).find((candidate) => candidate.name === databaseName);
  if (!database) throw new Error(`The Vault database is missing: ${databaseName}`);
  return database;
}

function sanitizeSensitiveObject<T extends Record<string, unknown>>(value: T): T {
  const next = { ...value };
  for (const key of Object.keys(next)) {
    if (/cvv|cvc|password|otp/i.test(key)) {
      delete next[key as keyof T];
    }
  }
  return next;
}

function buildReceiptBlocks(transaction: VaultTransaction) {
  return buildSectionedBlocks([
    {
      heading: "Notes",
      paragraphs: [
        transaction.description ?? "",
        transaction.purpose ? `Purpose: ${transaction.purpose}` : "",
        transaction.notes ?? "",
      ],
    },
    {
      heading: "History",
      paragraphs: [
        `Imported from The Vault transaction ${transaction.id}`,
        transaction.category ? `Category: ${transaction.category}` : "",
      ],
    },
  ]);
}

function buildEventBlocks(title: string, notes?: string) {
  return buildSectionedBlocks([
    {
      heading: "Notes",
      paragraphs: [notes ?? `${title} imported from The Vault.`],
    },
  ]);
}

function buildIdentityBlocks(identity: VaultIdentity, connections: VaultConnection[], servicesById: Map<string, VaultService>) {
  return buildSectionedBlocks([
    {
      heading: "Identity",
      paragraphs: [
        identity.email ? `Email: ${identity.email}` : "",
        identity.phone ? `Phone: ${identity.phone}` : "",
      ],
    },
    {
      heading: "Connected Services",
      bullets: connections.map((connection) => {
        const service = servicesById.get(connection.serviceId);
        return [service?.name ?? connection.serviceId, connection.email || connection.username, connection.status].filter(Boolean).join(" | ");
      }),
    },
  ]);
}

function attachmentFromVaultTransactionAttachment(transactionId: string, attachment: VaultTransactionAttachment, index: number): Attachment {
  return {
    id: buildNamespacedId("vault", "attachment", `${transactionId}:${index}`),
    recordId: buildNamespacedId("vault", "transaction", transactionId),
    ownerId: buildNamespacedId("vault", "transaction", transactionId),
    ownerType: "record",
    name: attachment.originalName ?? `Attachment ${index + 1}`,
    mimeType: attachment.mimeType,
    size: attachment.sizeBytes,
    localPath: attachment.filePath,
    dataUrl: attachment.dataBase64 ? `data:${attachment.mimeType};base64,${attachment.dataBase64}` : undefined,
    hash: attachment.sha256,
    createdAt: attachment.createdAt ?? new Date().toISOString(),
    source: "vault",
    sourceId: transactionId,
  };
}

async function importStructuredReceipts(snapshot: VaultStructuredSnapshot, manifest: MigrationManifest) {
  const database = await resolveVaultDatabase("Receipts");
  const receiptFields = await getFields(database.id);
  for (const transaction of snapshot.transactions ?? []) {
    const tags = [transaction.category, transaction.currency].filter((value): value is string => Boolean(value));
    const record: RecordItem = {
      id: buildNamespacedId("vault", "transaction", transaction.id),
      workspaceId: database.workspaceId,
      databaseId: database.id,
      tableId: database.id,
      title: transaction.description || transaction.vendor || `Transaction ${transaction.id}`,
      type: "receipt",
      properties: sanitizeSensitiveObject({
        category: transaction.category,
        document_type: "transaction",
        date: transaction.date,
        issuer: transaction.accountId,
        amount: typeof transaction.amountMinor === "number" ? transaction.amountMinor / 100 : undefined,
        vendor: transaction.vendor,
        location: transaction.location,
        status: transaction.type,
      }),
      fields: {},
      blocks: buildReceiptBlocks(transaction),
      documentContent: undefined,
      attachments: (transaction.attachments ?? []).map((attachment, index) => attachmentFromVaultTransactionAttachment(transaction.id, attachment, index)),
      tags,
      isUrgent: false,
      isSensitive: false,
      createdAt: transaction.createdAt ?? transaction.timestamp,
      updatedAt: transaction.updatedAt ?? transaction.timestamp,
      archived: false,
      favorite: false,
      urgent: false,
      source: "vault",
      sourceId: transaction.id,
      sourceUpdatedAt: transaction.updatedAt ?? transaction.timestamp,
    };

    for (const field of receiptFields) {
      if (field.key === "priority" && record.properties.priority === undefined) {
        record.properties.priority = "Medium";
      }
    }

    const saved = await upsertPreparedRecord(record);
    manifest.recordIds.push(saved.id);
    manifest.attachmentIds.push(...saved.attachments.map((attachment) => attachment.id));
    manifest.counts.records += 1;
    manifest.counts.attachments += saved.attachments.length;
  }
}

async function importStructuredAccounts(snapshot: VaultStructuredSnapshot, manifest: MigrationManifest) {
  const database = await resolveVaultDatabase("Payment Methods");
  for (const account of snapshot.accounts ?? []) {
    const record: RecordItem = {
      id: buildNamespacedId("vault", "account", account.id),
      workspaceId: database.workspaceId,
      databaseId: database.id,
      tableId: database.id,
      title: account.name,
      type: "payment_method",
      properties: {
        card_nickname: account.name,
        bank: account.name,
        billing_notes: [account.type, account.currency].filter(Boolean).join(" | "),
        status: account.type,
      },
      fields: {},
      blocks: buildSectionedBlocks([
        { heading: "Payment Method", paragraphs: [account.type ? `Type: ${account.type}` : "", account.currency ? `Currency: ${account.currency}` : ""] },
      ]),
      documentContent: undefined,
      attachments: [],
      tags: [account.currency, account.type].filter((value): value is string => Boolean(value)),
      isUrgent: false,
      isSensitive: true,
      createdAt: account.createdAt ?? new Date().toISOString(),
      updatedAt: account.updatedAt ?? account.createdAt ?? new Date().toISOString(),
      archived: false,
      favorite: false,
      urgent: false,
      source: "vault",
      sourceId: account.id,
      sourceUpdatedAt: account.updatedAt,
    };
    const saved = await upsertPreparedRecord(record);
    manifest.recordIds.push(saved.id);
    manifest.counts.records += 1;
  }
}

async function importStructuredEvents(snapshot: VaultStructuredSnapshot, manifest: MigrationManifest) {
  const database = await resolveVaultDatabase("Events");
  const events: RecordItem[] = [
    ...(snapshot.reminders ?? []).map((reminder) => ({
      id: buildNamespacedId("vault", "reminder", reminder.id),
      workspaceId: database.workspaceId,
      databaseId: database.id,
      tableId: database.id,
      title: reminder.title,
      type: "event" as const,
      properties: {
        category: "reminder",
        date: reminder.dueDateStart ?? reminder.dueDate,
        expiry_date: reminder.dueDateEnd,
        amount: reminder.amount,
        status: "Reminder",
      },
      fields: {},
      blocks: buildEventBlocks(reminder.title, reminder.notes),
      documentContent: undefined,
      attachments: [],
      tags: ["reminder"],
      isUrgent: false,
      isSensitive: false,
      createdAt: reminder.createdAt ?? new Date().toISOString(),
      updatedAt: reminder.updatedAt ?? reminder.createdAt ?? new Date().toISOString(),
      archived: false,
      favorite: false,
      urgent: false,
      source: "vault" as const,
      sourceId: reminder.id,
    })),
    ...(snapshot.subscriptions ?? []).map((subscription) => ({
      id: buildNamespacedId("vault", "subscription", subscription.id),
      workspaceId: database.workspaceId,
      databaseId: database.id,
      tableId: database.id,
      title: subscription.name,
      type: "event" as const,
      properties: {
        category: "subscription",
        date: subscription.nextRenewal,
        amount: subscription.amount,
        status: "Subscription",
      },
      fields: {},
      blocks: buildEventBlocks(subscription.name, subscription.notes),
      documentContent: undefined,
      attachments: [],
      tags: ["subscription"],
      isUrgent: false,
      isSensitive: false,
      createdAt: subscription.createdAt ?? new Date().toISOString(),
      updatedAt: subscription.updatedAt ?? subscription.createdAt ?? new Date().toISOString(),
      archived: false,
      favorite: false,
      urgent: false,
      source: "vault" as const,
      sourceId: subscription.id,
    })),
    ...(snapshot.installments ?? []).map((installment) => ({
      id: buildNamespacedId("vault", "installment", installment.id),
      workspaceId: database.workspaceId,
      databaseId: database.id,
      tableId: database.id,
      title: installment.name,
      type: "event" as const,
      properties: {
        category: "installment",
        date: installment.nextDue,
        amount: installment.totalAmount,
        status: "Installment",
      },
      fields: {},
      blocks: buildEventBlocks(installment.name, installment.notes),
      documentContent: undefined,
      attachments: [],
      tags: ["installment"],
      isUrgent: false,
      isSensitive: false,
      createdAt: installment.createdAt ?? new Date().toISOString(),
      updatedAt: installment.updatedAt ?? installment.createdAt ?? new Date().toISOString(),
      archived: false,
      favorite: false,
      urgent: false,
      source: "vault" as const,
      sourceId: installment.id,
    })),
    ...(snapshot.bills ?? []).map((bill) => ({
      id: buildNamespacedId("vault", "bill", bill.id),
      workspaceId: database.workspaceId,
      databaseId: database.id,
      tableId: database.id,
      title: bill.name,
      type: "event" as const,
      properties: {
        category: "bill",
        amount: bill.amount,
        status: "Bill",
        priority: bill.dueDay ? `Day ${bill.dueDay}` : undefined,
      },
      fields: {},
      blocks: buildEventBlocks(bill.name, bill.notes),
      documentContent: undefined,
      attachments: [],
      tags: ["bill", bill.currency].filter((value): value is string => Boolean(value)),
      isUrgent: false,
      isSensitive: false,
      createdAt: bill.createdAt ?? new Date().toISOString(),
      updatedAt: bill.updatedAt ?? bill.createdAt ?? new Date().toISOString(),
      archived: false,
      favorite: false,
      urgent: false,
      source: "vault" as const,
      sourceId: bill.id,
    })),
  ];

  for (const event of events) {
    const saved = await upsertPreparedRecord(event);
    manifest.recordIds.push(saved.id);
    manifest.counts.records += 1;
  }
}

async function importStructuredIdentity(snapshot: VaultStructuredSnapshot, manifest: MigrationManifest) {
  const database = await resolveVaultDatabase("Identity");
  const servicesById = new Map((snapshot.services ?? []).map((service) => [service.id, service]));
  const connectionsByIdentity = new Map<string, VaultConnection[]>();
  for (const connection of snapshot.connections ?? []) {
    const list = connectionsByIdentity.get(connection.identityId) ?? [];
    list.push(connection);
    connectionsByIdentity.set(connection.identityId, list);
  }

  for (const identity of snapshot.identities ?? []) {
    const connections = connectionsByIdentity.get(identity.id) ?? [];
    const record: RecordItem = {
      id: buildNamespacedId("vault", "identity", identity.id),
      workspaceId: database.workspaceId,
      databaseId: database.id,
      tableId: database.id,
      title: identity.name,
      type: "identity",
      properties: sanitizeSensitiveObject({
        category: "identity",
        issuer: "The Vault",
        people: identity.name,
        status: connections.length > 0 ? "Connected" : "Stored",
      }),
      fields: {},
      blocks: buildIdentityBlocks(identity, connections, servicesById),
      documentContent: undefined,
      attachments: [],
      tags: ["identity"],
      isUrgent: false,
      isSensitive: true,
      createdAt: identity.createdAt ?? new Date().toISOString(),
      updatedAt: identity.updatedAt ?? identity.createdAt ?? new Date().toISOString(),
      archived: false,
      favorite: false,
      urgent: false,
      source: "vault",
      sourceId: identity.id,
      sourceUpdatedAt: identity.updatedAt,
    };
    const saved = await upsertPreparedRecord(record);
    manifest.recordIds.push(saved.id);
    manifest.counts.records += 1;
  }
}

async function importStructuredNotes(snapshot: VaultStructuredSnapshot, manifest: MigrationManifest) {
  const database = await resolveVaultDatabase("Notes");
  for (const service of snapshot.services ?? []) {
    if (!service.notes && !service.website && !service.category) continue;
    const record: RecordItem = {
      id: buildNamespacedId("vault", "service-note", service.id),
      workspaceId: database.workspaceId,
      databaseId: database.id,
      tableId: database.id,
      title: service.name,
      type: "note",
      properties: {
        category: service.category,
        source: "service",
        status: "Imported",
      },
      fields: {},
      blocks: [
        paragraphBlock(service.notes ?? "Imported service note."),
        ...(service.website ? [paragraphBlock(`Website: ${service.website}`)] : []),
      ],
      documentContent: undefined,
      attachments: [],
      tags: [service.category].filter((value): value is string => Boolean(value)),
      isUrgent: false,
      isSensitive: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archived: false,
      favorite: false,
      urgent: false,
      source: "vault",
      sourceId: service.id,
    };
    const saved = await upsertPreparedRecord(record);
    manifest.recordIds.push(saved.id);
    manifest.counts.records += 1;
  }
}

export async function importVaultStructuredSnapshot(snapshot: VaultStructuredSnapshot): Promise<MigrationManifest> {
  const prior = await getMigrationManifest(VAULT_STRUCTURED_MANIFEST_ID);
  if (prior?.status === "completed") {
    return prior;
  }

  const manifest: MigrationManifest = {
    id: VAULT_STRUCTURED_MANIFEST_ID,
    source: "vault",
    status: "pending",
    startedAt: new Date().toISOString(),
    workspaceIds: [],
    databaseIds: [],
    recordIds: [],
    attachmentIds: [],
    counts: {
      workspaces: 1,
      databases: 5,
      records: 0,
      attachments: 0,
      warnings: 0,
      redactions: 0,
      collisions: 0,
    },
    warnings: [],
    redactions: [],
    collisions: [],
    missingAttachments: [],
    metadata: {
      accounts: snapshot.accounts?.length ?? 0,
      transactions: snapshot.transactions?.length ?? 0,
      identities: snapshot.identities?.length ?? 0,
    },
  };

  try {
    const databases = await Promise.all([
      resolveVaultDatabase("Documents"),
      resolveVaultDatabase("Identity"),
      resolveVaultDatabase("Receipts"),
      resolveVaultDatabase("Payment Methods"),
      resolveVaultDatabase("Events"),
      resolveVaultDatabase("Notes"),
    ]);
    manifest.workspaceIds = Array.from(new Set(databases.map((database) => database.workspaceId)));
    manifest.databaseIds = databases.map((database) => database.id);
    manifest.counts.workspaces = manifest.workspaceIds.length;
    manifest.counts.databases = manifest.databaseIds.length;

    await importStructuredAccounts(snapshot, manifest);
    await importStructuredReceipts(snapshot, manifest);
    await importStructuredEvents(snapshot, manifest);
    await importStructuredIdentity(snapshot, manifest);
    await importStructuredNotes(snapshot, manifest);

    manifest.status = "completed";
    manifest.completedAt = new Date().toISOString();
    await saveMigrationManifest(manifest);
    return manifest;
  } catch (error) {
    manifest.status = "failed";
    manifest.completedAt = new Date().toISOString();
    manifest.warnings.push({
      code: "vault-structured-import-failed",
      message: error instanceof Error ? error.message : "Unknown vault migration error",
    });
    manifest.counts.warnings = manifest.warnings.length;
    await saveMigrationManifest(manifest);
    throw error;
  }
}

export async function parseVaultExportZip(file: File | Blob): Promise<VaultZipImport> {
  const zip = await JSZip.loadAsync(file);
  const vaultCsv = zip.file("vault.csv");
  if (!vaultCsv) throw new Error("Missing vault.csv in The Vault export ZIP");

  const csvText = await vaultCsv.async("text");
  const rows = parseCsv(csvText);
  const transactionRows = rows.filter((row) => row.record_type === "TXN");
  const attachmentRows = rows.filter((row) => row.record_type === "ATTACHMENT");

  const attachmentsByTransactionId: Record<string, Attachment[]> = {};

  for (const attachmentRow of attachmentRows) {
    const transactionId = attachmentRow.transaction_id;
    const hash = attachmentRow.attachment_hash;
    const ext = attachmentRow.ext;
    if (!transactionId || !hash || !ext) continue;
    const zipEntry = Object.values(zip.files).find(
      (entry) => entry.name.startsWith("attachments/") && entry.name.endsWith(`__${hash}.${ext}`),
    );
    if (!zipEntry) continue;
    const bytes = await zipEntry.async("uint8array");
    const mimeType = attachmentRow.mime || "application/octet-stream";
    const attachment: Attachment = {
      id: buildNamespacedId("vault", "zip-attachment", `${transactionId}:${attachmentRow.attachment_index}`),
      recordId: buildNamespacedId("vault", "transaction", transactionId),
      ownerId: buildNamespacedId("vault", "transaction", transactionId),
      ownerType: "record",
      name: zipEntry.name.split("/").pop() || `attachment-${attachmentRow.attachment_index}.${ext}`,
      mimeType,
      size: bytes.byteLength,
      dataUrl: bytesToDataUrl(bytes, mimeType),
      hash,
      createdAt: new Date().toISOString(),
      source: "vault",
      sourceId: transactionId,
    };
    attachmentsByTransactionId[transactionId] ??= [];
    attachmentsByTransactionId[transactionId].push(attachment);
  }

  const receipts: VaultTransaction[] = transactionRows.map((row) => ({
    id: row.transaction_id,
    accountId: row.account,
    date: row.date,
    timestamp: row.timestamp || `${row.date}T00:00:00.000Z`,
    amountMinor: Number.parseInt(row.amount_minor || "0", 10),
    currency: row.currency,
    type: row.type,
    category: row.category,
    description: row.description,
    createdAt: row.timestamp || `${row.date}T00:00:00.000Z`,
    updatedAt: row.timestamp || `${row.date}T00:00:00.000Z`,
  }));

  return { receipts, attachmentsByTransactionId };
}

export async function importVaultExportZip(file: File | Blob): Promise<MigrationManifest> {
  const prior = await getMigrationManifest(VAULT_ZIP_MANIFEST_ID);
  if (prior?.status === "completed") {
    return prior;
  }

  const parsed = await parseVaultExportZip(file);
  const database = await resolveVaultDatabase("Receipts");
  const manifest: MigrationManifest = {
    id: VAULT_ZIP_MANIFEST_ID,
    source: "vault",
    status: "pending",
    startedAt: new Date().toISOString(),
    workspaceIds: [database.workspaceId],
    databaseIds: [database.id],
    recordIds: [],
    attachmentIds: [],
    counts: {
      workspaces: 1,
      databases: 1,
      records: 0,
      attachments: 0,
      warnings: 0,
      redactions: 0,
      collisions: 0,
    },
    warnings: [],
    redactions: [],
    collisions: [],
    missingAttachments: [],
    metadata: { zipImport: true },
  };

  try {
    for (const receipt of parsed.receipts) {
      const record: RecordItem = {
        id: buildNamespacedId("vault", "transaction", receipt.id),
        workspaceId: database.workspaceId,
        databaseId: database.id,
        tableId: database.id,
        title: receipt.description || `Receipt ${receipt.id}`,
        type: "receipt",
        properties: {
          category: receipt.category,
          document_type: "vault_export_zip",
          date: receipt.date,
          issuer: receipt.accountId,
          amount: receipt.amountMinor / 100,
          status: receipt.type,
        },
        fields: {},
        blocks: buildReceiptBlocks(receipt),
        documentContent: undefined,
        attachments: parsed.attachmentsByTransactionId[receipt.id] ?? [],
        tags: [receipt.category, receipt.currency].filter((value): value is string => Boolean(value)),
        isUrgent: false,
        isSensitive: false,
        createdAt: receipt.createdAt ?? receipt.timestamp,
        updatedAt: receipt.updatedAt ?? receipt.timestamp,
        archived: false,
        favorite: false,
        urgent: false,
        source: "vault",
        sourceId: receipt.id,
        sourceUpdatedAt: receipt.updatedAt ?? receipt.timestamp,
      };
      const saved = await upsertPreparedRecord(record);
      manifest.recordIds.push(saved.id);
      manifest.attachmentIds.push(...saved.attachments.map((attachment) => attachment.id));
      manifest.counts.records += 1;
      manifest.counts.attachments += saved.attachments.length;
    }

    manifest.status = "completed";
    manifest.completedAt = new Date().toISOString();
    await saveMigrationManifest(manifest);
    return manifest;
  } catch (error) {
    manifest.status = "failed";
    manifest.completedAt = new Date().toISOString();
    manifest.warnings.push({
      code: "vault-zip-import-failed",
      message: error instanceof Error ? error.message : "Unknown vault ZIP migration error",
    });
    manifest.counts.warnings = manifest.warnings.length;
    await saveMigrationManifest(manifest);
    throw error;
  }
}
