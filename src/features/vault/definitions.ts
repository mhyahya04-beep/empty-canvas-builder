import type {
  FieldOption,
  FieldType,
  TagColor,
  VaultDatabaseType,
  VaultRecordType,
} from "@/lib/types";

export interface FieldPreset {
  key: string;
  name: string;
  type: FieldType;
  options?: Array<{ label: string; color: TagColor }>;
  required?: boolean;
  hidden?: boolean;
  sensitive?: boolean;
  description?: string;
  relationTargetDatabaseTypes?: VaultDatabaseType[];
  relationAllowMultiple?: boolean;
}

export interface DatabasePreset {
  key: string;
  name: string;
  type: VaultDatabaseType;
  recordType: VaultRecordType;
  description?: string;
  fields: FieldPreset[];
}

export interface WorkspacePreset {
  key: string;
  name: string;
  icon: string;
  description: string;
  databases: DatabasePreset[];
}

function field(
  key: string,
  name: string,
  type: FieldType,
  options?: Array<{ label: string; color: TagColor }>,
  extras?: Partial<FieldPreset>,
): FieldPreset {
  return {
    key,
    name,
    type,
    options,
    ...extras,
  };
}

const statusOptions = [
  { label: "Inbox", color: "cream" },
  { label: "Active", color: "blue" },
  { label: "Pending", color: "gold" },
  { label: "Completed", color: "sage" },
  { label: "Archived", color: "charcoal" },
  { label: "Urgent", color: "rose" },
] as const;

const priorityOptions = [
  { label: "Low", color: "sage" },
  { label: "Medium", color: "blue" },
  { label: "High", color: "gold" },
  { label: "Urgent", color: "rose" },
] as const;

const sensitivityField = field("private_notes", "Private Notes", "longText", undefined, { sensitive: true });
const tagField = field("tags", "Tags", "multiSelect", []);
const relatedRecordsField = field("related_records", "Related Records", "relation");

export const vaultDocumentFields: FieldPreset[] = [
  field("category", "Category", "text"),
  field("document_type", "Document Type", "text"),
  field("date", "Date", "date"),
  field("expiry_date", "Expiry Date", "date"),
  field("issuer", "Issuer", "text"),
  field("amount", "Amount", "number"),
  field("vendor", "Vendor", "text"),
  field("warranty_date", "Warranty Date", "date"),
  field("location", "Location", "text"),
  field("people", "People", "longText"),
  relatedRecordsField,
  field("status", "Status", "select", [...statusOptions]),
  field("priority", "Priority", "select", [...priorityOptions]),
  tagField,
];

export const recipeFields: FieldPreset[] = [
  field("cuisine", "Cuisine", "text"),
  field("prep_time", "Prep Time", "text"),
  field("cook_time", "Cook Time", "text"),
  field("servings", "Servings", "text"),
  field("difficulty", "Difficulty", "select", [
    { label: "Easy", color: "sage" },
    { label: "Medium", color: "gold" },
    { label: "Advanced", color: "rose" },
  ]),
  field("source", "Source", "text"),
  field("rating", "Rating", "rating"),
  field("favorite", "Favorite", "checkbox"),
  field("meal_type", "Meal Type", "multiSelect", [
    { label: "Breakfast", color: "gold" },
    { label: "Lunch", color: "blue" },
    { label: "Dinner", color: "rose" },
    { label: "Dessert", color: "blush" },
    { label: "Snack", color: "sage" },
    { label: "Drink", color: "lavender" },
  ]),
  field("ingredients", "Ingredients", "longText"),
  field("linked_ingredients", "Linked Ingredients", "relation"),
  tagField,
];

export const REQUIRED_WORKSPACE_PRESETS: WorkspacePreset[] = [
  {
    key: "the-vault",
    name: "The Vault",
    icon: "🗄️",
    description: "Sensitive documents, receipts, identity records, payment references, and life admin.",
    databases: [
      { key: "documents", name: "Documents", type: "documents", recordType: "document", fields: vaultDocumentFields },
      {
        key: "identity",
        name: "Identity",
        type: "identity",
        recordType: "identity",
        fields: [
          ...vaultDocumentFields,
          field("identity_type", "Identity Type", "text"),
          field("identifier", "Identifier", "text", undefined, { sensitive: true }),
          field("issuing_country", "Issuing Country", "text"),
          sensitivityField,
        ],
      },
      {
        key: "receipts",
        name: "Receipts",
        type: "receipts",
        recordType: "receipt",
        fields: [
          ...vaultDocumentFields,
          field("product_name", "Product or Service", "text"),
          field("linked_payment_method", "Payment Method", "relation"),
          field("linked_events", "Linked Events", "relation"),
          field("linked_contact", "Linked Contact", "relation"),
        ],
      },
      {
        key: "payment-methods",
        name: "Payment Methods",
        type: "payment_methods",
        recordType: "payment_method",
        fields: [
          field("card_nickname", "Card Nickname", "text"),
          field("bank", "Bank", "text"),
          field("last_four", "Last Four Digits", "text", undefined, { sensitive: true }),
          field("expiry_date", "Expiry Date", "date", undefined, { sensitive: true }),
          field("billing_notes", "Billing Notes", "longText"),
          field("linked_subscriptions", "Linked Subscriptions", "relation"),
          field("status", "Status", "select", [...statusOptions]),
          field("priority", "Priority", "select", [...priorityOptions]),
          tagField,
          sensitivityField,
        ],
      },
      {
        key: "events",
        name: "Events",
        type: "events",
        recordType: "event",
        fields: [
          field("category", "Category", "text"),
          field("date", "Date", "date"),
          field("location", "Location", "text"),
          field("people", "People", "longText"),
          field("related_documents", "Related Documents", "relation"),
          field("related_receipts", "Related Receipts", "relation"),
          field("related_contacts", "Related Contacts", "relation"),
          field("status", "Status", "select", [...statusOptions]),
          field("priority", "Priority", "select", [...priorityOptions]),
          tagField,
        ],
      },
      {
        key: "notes",
        name: "Notes",
        type: "notes",
        recordType: "note",
        fields: [
          field("category", "Category", "text"),
          relatedRecordsField,
          field("status", "Status", "select", [...statusOptions]),
          field("priority", "Priority", "select", [...priorityOptions]),
          tagField,
        ],
      },
    ],
  },
  {
    key: "recipe-book",
    name: "Recipe Book",
    icon: "🍲",
    description: "Recipes, menus, ingredients, and meal plans in one editable cookbook.",
    databases: [
      { key: "recipes", name: "Recipes", type: "recipes", recordType: "recipe", fields: recipeFields },
      {
        key: "menus",
        name: "Menus",
        type: "menus",
        recordType: "menu",
        fields: [
          field("meal_type", "Meal Type", "multiSelect", [
            { label: "Breakfast", color: "gold" },
            { label: "Lunch", color: "blue" },
            { label: "Dinner", color: "rose" },
            { label: "Dessert", color: "blush" },
          ]),
          field("scheduled_for", "Scheduled For", "date"),
          field("servings", "Servings", "text"),
          field("recipes", "Recipes", "relation"),
          field("items", "Menu Items", "longText"),
          field("notes", "Notes", "longText"),
          tagField,
        ],
      },
      {
        key: "ingredients",
        name: "Ingredients",
        type: "ingredients",
        recordType: "ingredient",
        fields: [
          field("canonical_name", "Canonical Name", "text", undefined, { required: true }),
          field("category", "Category", "text"),
          field("aliases", "Aliases", "longText"),
          field("available", "Available", "checkbox"),
          field("used_in", "Used In", "relation"),
          tagField,
        ],
      },
      {
        key: "meal-plans",
        name: "Meal Plans",
        type: "meal_plans",
        recordType: "meal_plan",
        fields: [
          field("start_date", "Start Date", "date"),
          field("end_date", "End Date", "date"),
          field("status", "Status", "select", [...statusOptions]),
          field("recipes", "Recipes", "relation"),
          field("menus", "Menus", "relation"),
          field("meals", "Meals", "longText"),
          field("notes", "Notes", "longText"),
          tagField,
        ],
      },
      {
        key: "shopping-lists",
        name: "Shopping Lists",
        type: "shopping_lists",
        recordType: "shopping_list",
        fields: [
          field("planned_for", "Planned For", "date"),
          field("recipes", "Recipes", "relation"),
          field("meal_plan", "Meal Plan", "relation"),
          field("needed_items", "Needed Items", "longText"),
          field("missing_ingredients", "Missing Ingredients", "relation"),
          field("status", "Status", "select", [...statusOptions]),
          tagField,
        ],
      },
    ],
  },
  {
    key: "library",
    name: "Library",
    icon: "📚",
    description: "Books, magazines, and reading notes.",
    databases: [
      {
        key: "books",
        name: "Books",
        type: "books",
        recordType: "book",
        fields: [
          field("author", "Author", "text"),
          field("isbn", "ISBN", "text"),
          field("format", "Format", "text"),
          field("status", "Status", "select", [
            { label: "To Read", color: "cream" },
            { label: "Reading", color: "blue" },
            { label: "Finished", color: "sage" },
          ]),
          field("rating", "Rating", "rating"),
          field("started_at", "Started", "date"),
          field("finished_at", "Finished", "date"),
          field("reading_notes", "Reading Notes", "relation"),
          tagField,
        ],
      },
      {
        key: "magazines",
        name: "Magazines",
        type: "magazines",
        recordType: "magazine",
        fields: [
          field("issue", "Issue", "text"),
          field("publisher", "Publisher", "text"),
          field("publish_date", "Publish Date", "date"),
          field("status", "Status", "select", [...statusOptions]),
          field("reading_notes", "Reading Notes", "relation"),
          tagField,
        ],
      },
      {
        key: "reading-notes",
        name: "Reading Notes",
        type: "reading_notes",
        recordType: "reading_note",
        fields: [
          field("source", "Source", "text"),
          field("linked_title", "Linked Title", "text"),
          field("source_record", "Source Record", "relation"),
          field("date", "Date", "date"),
          field("status", "Status", "select", [...statusOptions]),
          tagField,
        ],
      },
    ],
  },
  {
    key: "social-vault",
    name: "Social Vault",
    icon: "👥",
    description: "Contacts, people notes, and relationship context.",
    databases: [
      {
        key: "contacts",
        name: "Contacts",
        type: "contacts",
        recordType: "social_contact",
        fields: [
          field("relationship", "Relationship", "text"),
          field("email", "Email", "email"),
          field("phone", "Phone", "phone"),
          field("location", "Location", "text"),
          field("related_events", "Related Events", "relation"),
          field("related_records", "Related Records", "relation"),
          field("status", "Status", "select", [...statusOptions]),
          tagField,
        ],
      },
      {
        key: "people-notes",
        name: "People Notes",
        type: "people_notes",
        recordType: "note",
        fields: [
          field("person", "Person", "text"),
          field("contact", "Contact", "relation"),
          relatedRecordsField,
          field("date", "Date", "date"),
          field("status", "Status", "select", [...statusOptions]),
          tagField,
        ],
      },
      {
        key: "relationship-tags",
        name: "Relationship Tags",
        type: "relationship_tags",
        recordType: "custom",
        fields: [
          field("tag_name", "Tag Name", "text"),
          field("meaning", "Meaning", "longText"),
          field("status", "Status", "select", [...statusOptions]),
        ],
      },
    ],
  },
  {
    key: "general-notes",
    name: "General Notes",
    icon: "📝",
    description: "Quick notes, study notes, and project notes.",
    databases: [
      {
        key: "quick-notes",
        name: "Quick Notes",
        type: "quick_notes",
        recordType: "note",
        fields: [field("date", "Date", "date"), relatedRecordsField, field("status", "Status", "select", [...statusOptions]), tagField],
      },
      {
        key: "study-notes",
        name: "Study Notes",
        type: "study_notes",
        recordType: "note",
        fields: [field("subject", "Subject", "text"), field("date", "Date", "date"), relatedRecordsField, field("status", "Status", "select", [...statusOptions]), tagField],
      },
      {
        key: "project-notes",
        name: "Project Notes",
        type: "project_notes",
        recordType: "note",
        fields: [field("project", "Project", "text"), field("date", "Date", "date"), relatedRecordsField, field("status", "Status", "select", [...statusOptions]), tagField],
      },
    ],
  },
  {
    key: "personal-knowledge-vault",
    name: "Personal Knowledge Vault",
    icon: "🧠",
    description: "Migrated legacy content items and personal knowledge records.",
    databases: [
      {
        key: "knowledge-records",
        name: "Knowledge Records",
        type: "knowledge",
        recordType: "knowledge_item",
        fields: [
          field("legacy_type", "Legacy Type", "text"),
          field("subject", "Subject", "text"),
          field("source", "Source", "text"),
          field("status", "Status", "select", [...statusOptions]),
          tagField,
        ],
      },
    ],
  },
];

export const CREATE_WORKSPACE_PRESETS = REQUIRED_WORKSPACE_PRESETS.filter(
  (preset) => preset.key !== "personal-knowledge-vault",
);

export function mapOptionsToFieldOptions(options?: FieldPreset["options"]): FieldOption[] | undefined {
  if (!options) return undefined;
  return options.map((option, index) => ({
    id: `${index}:${option.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    label: option.label,
    color: option.color,
  }));
}

export function getWorkspacePresetByKey(key: string): WorkspacePreset | undefined {
  return REQUIRED_WORKSPACE_PRESETS.find((preset) => preset.key === key);
}

export function getWorkspacePresetByName(name: string): WorkspacePreset | undefined {
  return REQUIRED_WORKSPACE_PRESETS.find((preset) => preset.name === name);
}

export function getDatabasePresetByName(workspacePreset: WorkspacePreset, databaseName: string): DatabasePreset | undefined {
  return workspacePreset.databases.find((database) => database.name === databaseName);
}
