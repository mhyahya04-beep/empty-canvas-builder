import { db } from "@/lib/db/db";
import {
  getFields,
  getMigrationManifest,
  saveMigrationManifest,
  upsertPreparedRecord,
} from "@/lib/storage";
import type { Attachment, MigrationManifest, RecordItem } from "@/lib/types";
import { buildNamespacedId, slugifyFieldKey } from "@/lib/migration/shape";
import { buildSectionedBlocks, headingBlock, paragraphBlock } from "@/lib/migration/document";

export interface CookbookIngredient {
  name: string;
  amount: string;
  notes?: string;
}

export interface CookbookStep {
  title: string;
  instructions: string;
  time?: string;
}

export interface CookbookCondiment {
  name: string;
  description: string;
  ingredients: CookbookIngredient[];
  steps: CookbookStep[];
}

export interface CookbookHealthScore {
  score: number | null;
  description: string;
}

export interface CookbookRecipe {
  id: string;
  name: string;
  region: string;
  style: string;
  categories: string[];
  foodTypes: string[];
  timings: string[];
  serves: string;
  cookTime: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  description: string;
  origin: string;
  liverScore: CookbookHealthScore;
  flavorFatigue: CookbookHealthScore;
  ingredients: Array<{ section: string; items: CookbookIngredient[] }>;
  steps: CookbookStep[];
  condiments?: CookbookCondiment[];
}

export interface CookbookRecipesDocument {
  schemaVersion: 1;
  updatedAt: string;
  recipes: CookbookRecipe[];
}

export interface CookbookIngredientsDocument {
  schemaVersion: 1;
  updatedAt: string;
  catalog: string[];
  availability: Record<string, boolean>;
}

export interface CookbookIngredientMetadata {
  category?: string;
  aliases?: string[];
}

export interface CookbookAttachmentDescriptor {
  name: string;
  mimeType: string;
  url?: string;
  localPath?: string;
  size?: number;
}

export interface CookbookMigrationInput {
  recipesDocument: CookbookRecipesDocument;
  ingredientsDocument: CookbookIngredientsDocument;
  ingredientMetadata?: Record<string, CookbookIngredientMetadata>;
  attachmentIndex?: Record<string, CookbookAttachmentDescriptor[]>;
}

const COOKBOOK_MANIFEST_ID = "migration:cookbook:documents";

async function resolveDatabase(databaseName: string) {
  const workspace = (await db.workspaces.toArray()).find((candidate) => candidate.name === "Recipe Book");
  if (!workspace) throw new Error("Recipe Book workspace is missing");
  const database = (await db.tablesStore.where({ workspaceId: workspace.id }).toArray()).find((candidate) => candidate.name === databaseName);
  if (!database) throw new Error(`Recipe Book database is missing: ${databaseName}`);
  return database;
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

function flattenRecipeIngredients(recipe: CookbookRecipe): string[] {
  return recipe.ingredients.flatMap((section) => section.items.map((ingredient) => ingredient.name));
}

function buildRecipeBlocks(recipe: CookbookRecipe) {
  const blocks = [headingBlock("Description")];
  blocks.push(paragraphBlock(recipe.description));
  blocks.push(headingBlock("Ingredients"));
  for (const section of recipe.ingredients) {
    blocks.push(headingBlock(section.section || "Ingredients", 3));
    blocks.push({
      type: "bulletList",
      content: section.items.map((ingredient) => ({
        type: "listItem",
        content: [paragraphBlock(`${ingredient.amount} ${ingredient.name}${ingredient.notes ? ` (${ingredient.notes})` : ""}`.trim())],
      })),
    });
  }
  blocks.push(headingBlock("Method"));
  blocks.push({
    type: "orderedList",
    attrs: { start: 1 },
    content: recipe.steps.map((step) => ({
      type: "listItem",
      content: [paragraphBlock(`${step.title}: ${step.instructions}${step.time ? ` (${step.time})` : ""}`)],
    })),
  });
  blocks.push(headingBlock("Notes"));
  blocks.push(paragraphBlock(`Origin: ${recipe.origin}`));
  blocks.push(paragraphBlock(`Calories: ${recipe.calories} | Protein: ${recipe.protein} | Carbs: ${recipe.carbs} | Fat: ${recipe.fat}`));
  blocks.push(paragraphBlock(`Liver Friendliness: ${recipe.liverScore.score ?? "Unknown"} - ${recipe.liverScore.description}`));
  blocks.push(paragraphBlock(`Flavor Fatigue: ${recipe.flavorFatigue.score ?? "Unknown"} - ${recipe.flavorFatigue.description}`));
  if (recipe.condiments && recipe.condiments.length > 0) {
    blocks.push(headingBlock("Variations"));
    for (const condiment of recipe.condiments) {
      blocks.push(paragraphBlock(`${condiment.name}: ${condiment.description}`));
    }
  }
  return blocks;
}

function buildRecipeAttachments(recipe: CookbookRecipe, attachmentIndex?: Record<string, CookbookAttachmentDescriptor[]>): Attachment[] {
  const candidates = attachmentIndex?.[recipe.id] ?? attachmentIndex?.[slugifyFieldKey(recipe.name)] ?? [];
  return candidates.map((attachment, index) => ({
    id: buildNamespacedId("cookbook", "attachment", `${recipe.id}:${index}`),
    recordId: buildNamespacedId("cookbook", "recipe", recipe.id),
    ownerId: buildNamespacedId("cookbook", "recipe", recipe.id),
    ownerType: "record",
    name: attachment.name,
    mimeType: attachment.mimeType,
    url: attachment.url,
    localPath: attachment.localPath,
    size: attachment.size,
    createdAt: new Date().toISOString(),
    source: "cookbook",
    sourceId: recipe.id,
  }));
}

async function buildRecipeRecord(recipe: CookbookRecipe, attachmentIndex?: Record<string, CookbookAttachmentDescriptor[]>): Promise<RecordItem> {
  const database = await resolveDatabase("Recipes");
  const fields = await getFields(database.id);
  const properties: Record<string, unknown> = {
    cuisine: recipe.region,
    prep_time: "",
    cook_time: recipe.cookTime,
    servings: recipe.serves,
    difficulty: recipe.style,
    source: recipe.origin,
    rating: recipe.liverScore.score ?? undefined,
    favorite: false,
    meal_type: uniqueStrings(recipe.timings),
    ingredients: flattenRecipeIngredients(recipe).join(", "),
    tags: uniqueStrings([...recipe.categories, ...recipe.foodTypes, ...recipe.timings, recipe.style]),
  };

  for (const field of fields) {
    if (field.key === "rating" && typeof properties.rating !== "number") {
      delete properties[field.key];
    }
  }

  return {
    id: buildNamespacedId("cookbook", "recipe", recipe.id),
    workspaceId: database.workspaceId,
    databaseId: database.id,
    tableId: database.id,
    title: recipe.name,
    type: "recipe",
    properties,
    fields: {},
    blocks: buildRecipeBlocks(recipe),
    documentContent: undefined,
    attachments: buildRecipeAttachments(recipe, attachmentIndex),
    tags: uniqueStrings([...recipe.categories, ...recipe.foodTypes, ...recipe.timings, recipe.style]),
    isUrgent: false,
    isSensitive: false,
    createdAt: recipe.id,
    updatedAt: recipe.id,
    archived: false,
    favorite: false,
    urgent: false,
    source: "cookbook",
    sourceId: recipe.id,
    sourceUpdatedAt: undefined,
  };
}

function buildIngredientBlocks(name: string, metadata: CookbookIngredientMetadata | undefined, available: boolean | undefined) {
  return buildSectionedBlocks([
    {
      heading: "Ingredient",
      paragraphs: [
        metadata?.category ? `Category: ${metadata.category}` : "",
        typeof available === "boolean" ? `Available: ${available ? "Yes" : "No"}` : "",
        metadata?.aliases && metadata.aliases.length > 0 ? `Aliases: ${metadata.aliases.join(", ")}` : "",
      ],
    },
  ]);
}

async function buildIngredientRecord(
  ingredientName: string,
  availability: boolean | undefined,
  ingredientMetadata?: Record<string, CookbookIngredientMetadata>,
): Promise<RecordItem> {
  const database = await resolveDatabase("Ingredients");
  const normalizedKey = ingredientName.trim().toLowerCase();
  const metadata = ingredientMetadata?.[normalizedKey] ?? ingredientMetadata?.[ingredientName] ?? undefined;
  return {
    id: buildNamespacedId("cookbook", "ingredient", normalizedKey.replace(/[^a-z0-9]+/g, "-")),
    workspaceId: database.workspaceId,
    databaseId: database.id,
    tableId: database.id,
    title: ingredientName,
    type: "ingredient",
    properties: {
      canonical_name: ingredientName,
      category: metadata?.category,
      aliases: metadata?.aliases?.join(", "),
      available: availability,
      tags: metadata?.category ? [metadata.category] : [],
    },
    fields: {},
    blocks: buildIngredientBlocks(ingredientName, metadata, availability),
    documentContent: undefined,
    attachments: [],
    tags: metadata?.category ? [metadata.category] : [],
    isUrgent: false,
    isSensitive: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    archived: false,
    favorite: false,
    urgent: false,
    source: "cookbook",
    sourceId: ingredientName,
  };
}

export async function importCookbookDocuments(input: CookbookMigrationInput): Promise<MigrationManifest> {
  const prior = await getMigrationManifest(COOKBOOK_MANIFEST_ID);
  if (prior?.status === "completed" && prior.metadata?.updatedAt === input.recipesDocument.updatedAt) {
    return prior;
  }

  const manifest: MigrationManifest = {
    id: COOKBOOK_MANIFEST_ID,
    source: "cookbook",
    status: "pending",
    startedAt: new Date().toISOString(),
    workspaceIds: [],
    databaseIds: [],
    recordIds: [],
    attachmentIds: [],
    counts: {
      workspaces: 0,
      databases: 0,
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
      updatedAt: input.recipesDocument.updatedAt,
      ingredientUpdatedAt: input.ingredientsDocument.updatedAt,
    },
  };

  try {
    const databases = await Promise.all([
      resolveDatabase("Recipes"),
      resolveDatabase("Menus"),
      resolveDatabase("Ingredients"),
      resolveDatabase("Meal Plans"),
      resolveDatabase("Shopping Lists"),
    ]);
    manifest.workspaceIds = uniqueStrings(databases.map((database) => database.workspaceId));
    manifest.databaseIds = databases.map((database) => database.id);
    manifest.counts.workspaces = manifest.workspaceIds.length;
    manifest.counts.databases = manifest.databaseIds.length;

    for (const recipe of input.recipesDocument.recipes) {
      const record = await buildRecipeRecord(recipe, input.attachmentIndex);
      const saved = await upsertPreparedRecord({
        ...record,
        createdAt: input.recipesDocument.updatedAt,
        updatedAt: input.recipesDocument.updatedAt,
        sourceUpdatedAt: input.recipesDocument.updatedAt,
      });
      manifest.recordIds.push(saved.id);
      manifest.attachmentIds.push(...saved.attachments.map((attachment) => attachment.id));
      manifest.counts.records += 1;
      manifest.counts.attachments += saved.attachments.length;
    }

    for (const ingredientName of input.ingredientsDocument.catalog) {
      const normalizedKey = ingredientName.trim().toLowerCase();
      const record = await buildIngredientRecord(
        ingredientName,
        input.ingredientsDocument.availability[normalizedKey],
        input.ingredientMetadata,
      );
      const saved = await upsertPreparedRecord({
        ...record,
        createdAt: input.ingredientsDocument.updatedAt,
        updatedAt: input.ingredientsDocument.updatedAt,
        sourceUpdatedAt: input.ingredientsDocument.updatedAt,
      });
      manifest.recordIds.push(saved.id);
      manifest.counts.records += 1;
    }

    manifest.status = "completed";
    manifest.completedAt = new Date().toISOString();
    await saveMigrationManifest(manifest);
    return manifest;
  } catch (error) {
    manifest.status = "failed";
    manifest.completedAt = new Date().toISOString();
    manifest.warnings.push({
      code: "cookbook-import-failed",
      message: error instanceof Error ? error.message : "Unknown cookbook migration error",
    });
    manifest.counts.warnings = manifest.warnings.length;
    await saveMigrationManifest(manifest);
    throw error;
  }
}
