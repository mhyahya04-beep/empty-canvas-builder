import type {
  DatabaseTable,
  EditorBlock,
  Field,
  FieldType,
  RecordItem,
  VaultDatabaseType,
  VaultRecordType,
} from "@/lib/types";

const DATABASE_TYPE_INFERENCES: Array<{ match: RegExp; type: VaultDatabaseType }> = [
  { match: /payment/i, type: "payment_methods" },
  { match: /receipt/i, type: "receipts" },
  { match: /identit/i, type: "identity" },
  { match: /event|reminder|bill|subscription|installment/i, type: "events" },
  { match: /recipe/i, type: "recipes" },
  { match: /menu/i, type: "menus" },
  { match: /ingredient/i, type: "ingredients" },
  { match: /meal\s*plan/i, type: "meal_plans" },
  { match: /shopping\s*list/i, type: "shopping_lists" },
  { match: /book/i, type: "books" },
  { match: /magazine/i, type: "magazines" },
  { match: /reading/i, type: "reading_notes" },
  { match: /contact/i, type: "contacts" },
  { match: /people\s*note/i, type: "people_notes" },
  { match: /relationship/i, type: "relationship_tags" },
  { match: /study\s*note/i, type: "study_notes" },
  { match: /project\s*note/i, type: "project_notes" },
  { match: /quick\s*note/i, type: "quick_notes" },
  { match: /note/i, type: "notes" },
  { match: /document|archive/i, type: "documents" },
  { match: /knowledge/i, type: "knowledge" },
];

const RECORD_TYPE_BY_DATABASE: Record<VaultDatabaseType, VaultRecordType> = {
  books: "book",
  magazines: "magazine",
  events: "event",
  identity: "identity",
  notes: "note",
  payment_methods: "payment_method",
  receipts: "receipt",
  recipes: "recipe",
  menus: "menu",
  ingredients: "ingredient",
  meal_plans: "meal_plan",
  shopping_lists: "shopping_list",
  social: "social_contact",
  documents: "document",
  custom: "custom",
  reading_notes: "reading_note",
  contacts: "social_contact",
  people_notes: "note",
  relationship_tags: "custom",
  quick_notes: "note",
  study_notes: "note",
  project_notes: "note",
  knowledge: "knowledge_item",
};

export function slugifyFieldKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64) || "field";
}

export function inferDatabaseType(name: string, fallback: VaultDatabaseType = "custom"): VaultDatabaseType {
  for (const candidate of DATABASE_TYPE_INFERENCES) {
    if (candidate.match.test(name)) {
      return candidate.type;
    }
  }
  return fallback;
}

export function inferRecordType(databaseType: VaultDatabaseType): VaultRecordType {
  return RECORD_TYPE_BY_DATABASE[databaseType] ?? "custom";
}

export function isSensitiveDatabaseType(databaseType: VaultDatabaseType): boolean {
  return databaseType === "identity" || databaseType === "payment_methods";
}

export function extractBlocksFromDocumentContent(documentContent: unknown): EditorBlock[] {
  if (!documentContent || typeof documentContent !== "object") return [];
  const asObject = documentContent as Record<string, unknown>;
  const content = asObject.content;
  if (!Array.isArray(content)) return [];
  return content.filter((entry): entry is EditorBlock => typeof entry === "object" && entry !== null) as EditorBlock[];
}

export function buildDocumentContentFromBlocks(blocks: EditorBlock[]): unknown {
  return {
    type: "doc",
    content: Array.isArray(blocks) ? blocks : [],
  };
}

export function normalizeFieldOptions(field: Field): Field {
  if (!field.options) return field;
  return {
    ...field,
    options: field.options.map((option, index) => ({
      ...option,
      id: option.id || `${index}:${slugifyFieldKey(option.label)}`,
    })),
  };
}

export function normalizeFieldShape(field: Partial<Field> & Pick<Field, "id" | "name" | "type" | "workspaceId" | "tableId">): Field {
  return normalizeFieldOptions({
    databaseId: field.databaseId ?? field.tableId,
    key: field.key ?? slugifyFieldKey(field.name),
    order: field.order ?? 0,
    ...field,
  } as Field);
}

export function normalizeRecordBlocks(record: Partial<RecordItem>): EditorBlock[] {
  if (Array.isArray(record.blocks)) {
    return record.blocks.filter((entry): entry is EditorBlock => typeof entry === "object" && entry !== null);
  }
  return extractBlocksFromDocumentContent(record.documentContent);
}

export function normalizeRecordProperties(record: Partial<RecordItem>, fields: Field[]): { properties: Record<string, unknown>; fields: Record<string, unknown> } {
  const legacyFields = record.fields && typeof record.fields === "object" ? record.fields : {};
  const nextProperties: Record<string, unknown> = record.properties && typeof record.properties === "object" ? { ...record.properties } : {};
  const nextFields: Record<string, unknown> = legacyFields ? { ...legacyFields } : {};

  for (const field of fields) {
    const keyedValue = nextProperties[field.key];
    const legacyValue = nextFields[field.id];
    if (keyedValue === undefined && legacyValue !== undefined) {
      nextProperties[field.key] = legacyValue;
    }
    if (legacyValue === undefined && keyedValue !== undefined) {
      nextFields[field.id] = keyedValue;
    }
  }

  return { properties: nextProperties, fields: nextFields };
}

export function getRecordFieldValue(record: Partial<RecordItem>, field: Pick<Field, "id" | "key">): unknown {
  if (record.properties && field.key in record.properties) {
    return record.properties[field.key];
  }
  return record.fields?.[field.id];
}

export function setRecordFieldValue(record: RecordItem, field: Pick<Field, "id" | "key">, value: unknown): RecordItem {
  const nextProperties = { ...(record.properties ?? {}), [field.key]: value };
  const nextFields = { ...(record.fields ?? {}), [field.id]: value };
  return {
    ...record,
    properties: nextProperties,
    fields: nextFields,
  };
}

export function ensureDatabaseArrays(database: DatabaseTable): DatabaseTable {
  return {
    ...database,
    fields: Array.isArray(database.fields) ? database.fields : [],
    recordIds: Array.isArray(database.recordIds) ? database.recordIds : [],
  };
}

export function buildNamespacedId(source: string, kind: string, rawId: string): string {
  return `${source}:${kind}:${rawId}`;
}

export function inferFieldTypeFromValue(value: unknown): FieldType {
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "checkbox";
  if (Array.isArray(value)) return "multiSelect";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return "date";
  return "text";
}
