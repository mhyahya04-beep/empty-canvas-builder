import { beforeEach, describe, expect, it } from "vitest";
import { importCookbookDocuments } from "@/lib/migration/cookbook";
import { buildNamespacedId } from "@/lib/migration/shape";
import { db } from "@/lib/db/db";
import { ensureRequiredWorkspaceStructure, listAttachments } from "@/lib/storage";
import { resetUnifiedDb } from "@/test/db";

describe("importCookbookDocuments", () => {
  beforeEach(async () => {
    await resetUnifiedDb();
    await ensureRequiredWorkspaceStructure();
  });

  it("imports recipes and ingredients, preserves attachments, and stays idempotent", async () => {
    const updatedAt = "2026-04-26T10:00:00.000Z";
    const manifest = await importCookbookDocuments({
      recipesDocument: {
        schemaVersion: 1,
        updatedAt,
        recipes: [
          {
            id: "rendang-1",
            name: "Beef Rendang",
            region: "Malay",
            style: "Medium",
            categories: ["Dinner"],
            foodTypes: ["Main"],
            timings: ["Dinner"],
            serves: "4",
            cookTime: "2h",
            calories: "500",
            protein: "30g",
            carbs: "12g",
            fat: "40g",
            description: "Slow-cooked spiced beef.",
            origin: "Family notebook",
            liverScore: { score: 4, description: "Balanced" },
            flavorFatigue: { score: 2, description: "Low fatigue" },
            ingredients: [
              {
                section: "Main",
                items: [
                  { name: "Beef", amount: "1kg" },
                  { name: "Coconut milk", amount: "500ml" },
                ],
              },
            ],
            steps: [
              {
                title: "Simmer",
                instructions: "Cook until tender and reduced.",
                time: "120m",
              },
            ],
            condiments: [
              {
                name: "Sambal",
                description: "Optional heat.",
                ingredients: [],
                steps: [],
              },
            ],
          },
        ],
      },
      ingredientsDocument: {
        schemaVersion: 1,
        updatedAt,
        catalog: ["Beef", "Coconut milk"],
        availability: {
          beef: true,
          "coconut milk": false,
        },
      },
      attachmentIndex: {
        "rendang-1": [
          {
            name: "rendang-menu.pdf",
            mimeType: "application/pdf",
            url: "https://example.com/rendang-menu.pdf",
          },
        ],
      },
    });

    expect(manifest.status).toBe("completed");
    expect(manifest.counts.databases).toBe(5);
    expect(manifest.counts.records).toBe(3);
    expect(manifest.counts.attachments).toBe(1);

    const recipeId = buildNamespacedId("cookbook", "recipe", "rendang-1");
    const recipe = await db.records.get(recipeId);
    expect(recipe?.type).toBe("recipe");
    expect(recipe?.properties.cuisine).toBe("Malay");
    expect(recipe?.tags).toContain("Dinner");
    expect(recipe?.blocks.some((block) => block.type === "heading")).toBe(true);

    const attachments = await listAttachments(recipeId);
    expect(attachments).toHaveLength(1);
    expect(attachments[0]?.name).toBe("rendang-menu.pdf");
    expect(attachments[0]?.url).toBe("https://example.com/rendang-menu.pdf");

    const ingredient = await db.records.get(buildNamespacedId("cookbook", "ingredient", "beef"));
    expect(ingredient?.type).toBe("ingredient");
    expect(ingredient?.properties.available).toBe(true);

    const rerun = await importCookbookDocuments({
      recipesDocument: {
        schemaVersion: 1,
        updatedAt,
        recipes: [],
      },
      ingredientsDocument: {
        schemaVersion: 1,
        updatedAt,
        catalog: [],
        availability: {},
      },
    });

    expect(rerun.completedAt).toBe(manifest.completedAt);
    expect(await db.records.where("source").equals("cookbook").count()).toBe(3);
  });
});
