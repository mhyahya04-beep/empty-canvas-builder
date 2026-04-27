import type { Field, FieldOption, FieldType, TagColor, View } from "./types";
import { uid, now } from "./db";

interface TemplateFieldDef {
  name: string;
  type: FieldType;
  options?: { label: string; color: TagColor }[];
}

interface TemplateViewDef {
  name: string;
  type: View["type"];
  groupByFieldName?: string; // resolved at seed time
  visibleFieldNames?: string[];
}

interface TemplateRecordDef {
  title: string;
  values?: Record<string, unknown>; // keyed by field name; option values use label
}

export interface TemplateDef {
  key: string;
  name: string;
  icon: string;
  description: string;
  fields: TemplateFieldDef[];
  views?: TemplateViewDef[];
  starterRecords?: TemplateRecordDef[];
}

export const TEMPLATES: TemplateDef[] = [
  {
    key: "watchlist",
    name: "Watchlist",
    icon: "🎬",
    description: "Films, shows, anime — every screen obsession.",
    fields: [
      { name: "Title", type: "text" },
      { name: "Category", type: "select", options: [
        { label: "Film", color: "rose" }, { label: "Series", color: "blue" },
        { label: "Anime", color: "lavender" }, { label: "Documentary", color: "sage" },
      ]},
      { name: "Added On", type: "date" },
      { name: "Added From", type: "text" },
      { name: "Recommended By", type: "text" },
      { name: "Place I Was", type: "text" },
      { name: "Status", type: "select", options: [
        { label: "Want to Watch", color: "cream" }, { label: "Watching", color: "blue" },
        { label: "Completed", color: "sage" }, { label: "Dropped", color: "mocha" },
        { label: "On Hold", color: "lavender" },
      ]},
      { name: "Rating", type: "rating" },
      { name: "Tags", type: "multiSelect", options: [
        { label: "Cozy", color: "blush" }, { label: "Cinematic", color: "gold" }, { label: "Comfort", color: "rose" },
      ]},
    ],
    views: [
      { name: "All Records", type: "table" },
      { name: "By Status", type: "board", groupByFieldName: "Status" },
      { name: "Gallery", type: "gallery" },
    ],
    starterRecords: [
      { title: "Arifureta", values: { Category: "Anime", "Added On": "2021-10-01T18:07", "Added From": "Instagram", "Recommended By": "Yahya", "Place I Was": "Saudi", Status: "Want to Watch", Rating: 3, Tags: ["Cinematic"] } },
      { title: "Persona 5: The Animation", values: { Category: "Anime", "Added From": "TikTok", "Recommended By": "Yahya", Status: "Want to Watch" } },
      { title: "Death Note", values: { Category: "Anime", "Added From": "Instagram", Status: "Completed", Rating: 5 } },
      { title: "Monster", values: { Category: "Anime", "Added From": "Instagram", Status: "Watching", Rating: 5 } },
      { title: "Another", values: { Category: "Anime", "Added From": "Instagram", Status: "Want to Watch", Tags: ["Cozy"] } },
    ],
  },
  {
    key: "studyVault",
    name: "Study Vault",
    icon: "📚",
    description: "Topics, deadlines, and mastery tracking.",
    fields: [
      { name: "Topic", type: "text" },
      { name: "Subject", type: "select", options: [
        { label: "Math", color: "blue" }, { label: "Science", color: "sage" },
        { label: "Language", color: "rose" }, { label: "History", color: "mocha" },
      ]},
      { name: "Deadline", type: "date" },
      { name: "Difficulty", type: "rating" },
      { name: "Status", type: "select", options: [
        { label: "Not Started", color: "cream" }, { label: "Learning", color: "blue" },
        { label: "Reviewing", color: "lavender" }, { label: "Mastered", color: "sage" },
        { label: "Needs Help", color: "rose" },
      ]},
      { name: "Exam Relevance", type: "rating" },
      { name: "Resources", type: "url" },
      { name: "Tags", type: "multiSelect", options: [] },
    ],
    views: [
      { name: "All Topics", type: "table" },
      { name: "By Status", type: "board", groupByFieldName: "Status" },
      { name: "Deadlines", type: "calendar" },
    ],
    starterRecords: [
      { title: "Cardiovascular Physiology", values: { Subject: "Science", Status: "Reviewing", Difficulty: 5, "Exam Relevance": 5 } },
      { title: "Neuroanatomy: Cranial Nerves", values: { Subject: "Science", Status: "Learning", Difficulty: 5 } },
      { title: "Biochemistry: Metabolism", values: { Subject: "Science", Status: "Not Started", Difficulty: 3 } },
    ],
  },
  {
    key: "glowUp",
    name: "Glow-Up Tracker",
    icon: "✨",
    description: "Beauty, body, and ritual log.",
    fields: [
      { name: "Entry", type: "text" },
      { name: "Date", type: "date" },
      { name: "Category", type: "select", options: [
        { label: "Food", color: "sage" }, { label: "Supplements", color: "cream" },
        { label: "Skincare", color: "blush" }, { label: "Hair", color: "rose" },
        { label: "Workout", color: "blue" }, { label: "Sleep", color: "lavender" },
        { label: "Mood", color: "gold" }, { label: "Beauty", color: "blush" },
      ]},
      { name: "Goal", type: "text" },
      { name: "Products/Foods", type: "longText" },
      { name: "Rating", type: "rating" },
      { name: "Notes", type: "longText" },
      { name: "Tags", type: "multiSelect", options: [] },
    ],
    views: [
      { name: "All Entries", type: "table" },
      { name: "By Category", type: "board", groupByFieldName: "Category" },
      { name: "Calendar", type: "calendar" },
    ],
    starterRecords: [
      { title: "Kefir Yogurt Bowl", values: { Category: "Food", Goal: "digestion, skin, protein", Rating: 4 } },
      { title: "Hair Oil Routine", values: { Category: "Hair", Goal: "shine, growth, softness" } },
      { title: "Evening Skincare Reset", values: { Category: "Skincare", Goal: "barrier repair, glow" } },
    ],
  },
  {
    key: "projectHub",
    name: "Project Hub",
    icon: "🛠️",
    description: "Ideas, builds, and shipped work.",
    fields: [
      { name: "Project", type: "text" },
      { name: "Status", type: "select", options: [
        { label: "Idea", color: "cream" }, { label: "Planning", color: "lavender" },
        { label: "Building", color: "blue" }, { label: "Testing", color: "gold" },
        { label: "Complete", color: "sage" }, { label: "Paused", color: "mocha" },
      ]},
      { name: "Priority", type: "select", options: [
        { label: "Low", color: "sage" }, { label: "Medium", color: "blue" },
        { label: "High", color: "gold" }, { label: "Urgent", color: "rose" },
      ]},
      { name: "Deadline", type: "date" },
      { name: "Tech Stack", type: "multiSelect", options: [
        { label: "React", color: "blue" }, { label: "TypeScript", color: "lavender" }, { label: "Node", color: "sage" },
      ]},
      { name: "Progress", type: "number" },
      { name: "Notes", type: "longText" },
      { name: "Tags", type: "multiSelect", options: [] },
    ],
    views: [
      { name: "All Projects", type: "table" },
      { name: "Kanban", type: "board", groupByFieldName: "Status" },
      { name: "Roadmap", type: "calendar" },
    ],
    starterRecords: [
      { title: "Vault Atelier", values: { Status: "Building", Priority: "Urgent", Progress: 45, "Tech Stack": ["React", "TypeScript"] } },
      { title: "Recipe Archive", values: { Status: "Idea", Priority: "Medium" } },
      { title: "Study Dashboard", values: { Status: "Planning", Priority: "High" } },
    ],
  },
  {
    key: "recipeBook",
    name: "Recipe Book",
    icon: "🍰",
    description: "Recipes, macros, and food memories.",
    fields: [
      { name: "Recipe", type: "text" },
      { name: "Cuisine", type: "select", options: [
        { label: "Italian", color: "rose" }, { label: "Asian", color: "blue" },
        { label: "Mediterranean", color: "sage" }, { label: "Dessert", color: "blush" },
      ]},
      { name: "Ingredients", type: "longText" },
      { name: "Calories", type: "number" },
      { name: "Protein", type: "number" },
      { name: "Rating", type: "rating" },
      { name: "Goal", type: "select", options: [
        { label: "Bulk", color: "gold" }, { label: "Cut", color: "sage" }, { label: "Comfort", color: "rose" },
      ]},
      { name: "Tags", type: "multiSelect", options: [] },
    ],
    views: [
      { name: "All Recipes", type: "table" },
      { name: "Gallery", type: "gallery" },
      { name: "By Cuisine", type: "board", groupByFieldName: "Cuisine" },
    ],
    starterRecords: [
      { title: "Honey Cinnamon Yogurt Bowl", values: { Cuisine: "Mediterranean", Ingredients: "Greek yogurt, honey, cinnamon, chia, flax", Protein: 20, Rating: 5 } },
      { title: "Air-Fried Eggplant Chips", values: { Cuisine: "Mediterranean", Ingredients: "eggplant, olive oil, pomegranate molasses", Rating: 4 } },
      { title: "Avocado Egg Toast", values: { Cuisine: "Mediterranean", Rating: 4 } },
    ],
  },
  {
    key: "memoryArchive",
    name: "Memory Archive",
    icon: "🌙",
    description: "Moments to keep forever.",
    fields: [
      { name: "Memory", type: "text" },
      { name: "Date", type: "date" },
      { name: "Place", type: "text" },
      { name: "Person", type: "text" },
      { name: "Source", type: "text" },
      { name: "Mood", type: "select", options: [
        { label: "Joyful", color: "gold" }, { label: "Calm", color: "sage" },
        { label: "Nostalgic", color: "lavender" }, { label: "Tender", color: "blush" },
      ]},
      { name: "Tags", type: "multiSelect", options: [] },
    ],
    views: [
      { name: "Timeline", type: "list" },
      { name: "By Mood", type: "board", groupByFieldName: "Mood" },
      { name: "Calendar", type: "calendar" },
    ],
    starterRecords: [
      { title: "Instagram Anime Recommendation", values: { Place: "Saudi", Source: "Instagram", Mood: "Nostalgic" } },
      { title: "University Study Day", values: { Place: "Bahrain", Mood: "Joyful" } },
      { title: "Cozy Cafe Note", values: { Mood: "Calm" } },
    ],
  },
  {
    key: "wishlist",
    name: "Wishlist",
    icon: "🎀",
    description: "Things wanted, considered, owned.",
    fields: [
      { name: "Item", type: "text" },
      { name: "Category", type: "select", options: [
        { label: "Fashion", color: "rose" }, { label: "Beauty", color: "blush" },
        { label: "Tech", color: "blue" }, { label: "Home", color: "sage" }, { label: "Books", color: "mocha" },
      ]},
      { name: "Price", type: "number" },
      { name: "Brand", type: "text" },
      { name: "Link", type: "url" },
      { name: "Priority", type: "select", options: [
        { label: "Low", color: "sage" }, { label: "Medium", color: "blue" }, { label: "High", color: "gold" },
      ]},
      { name: "Status", type: "select", options: [
        { label: "Want", color: "rose" }, { label: "Considering", color: "lavender" },
        { label: "Bought", color: "sage" }, { label: "Skipped", color: "mocha" },
      ]},
      { name: "Tags", type: "multiSelect", options: [] },
    ],
    views: [
      { name: "All Items", type: "table" },
      { name: "By Status", type: "board", groupByFieldName: "Status" },
      { name: "Gallery", type: "gallery" },
    ],
    starterRecords: [
      { title: "Pearl Hair Clips", values: { Category: "Beauty", Priority: "Medium", Status: "Want" } },
      { title: "Pink Notebook", values: { Category: "Books", Priority: "High", Status: "Considering" } },
      { title: "Ballet Flats", values: { Category: "Fashion", Priority: "Medium", Status: "Want" } },
    ],
  },
  {
    key: "blank",
    name: "Blank",
    icon: "📄",
    description: "Start from scratch.",
    fields: [
      { name: "Title", type: "text" },
    ],
    views: [{ name: "All Records", type: "table" }],
  },
];

export interface TemplateSeed {
  fields: Field[];
  views: View[];
  records: { title: string; values: Record<string, unknown> }[];
}

export function buildSeedForTemplate(spaceId: string, templateKey: string): TemplateSeed {
  const tpl = TEMPLATES.find((t) => t.key === templateKey) ?? TEMPLATES[TEMPLATES.length - 1];
  const fields: Field[] = tpl.fields.map((f, i) => {
    const opts: FieldOption[] | undefined = f.options
      ? f.options.map((o) => ({ id: uid(), label: o.label, color: o.color }))
      : f.type === "select" || f.type === "multiSelect" ? [] : undefined;
    return { id: uid(), spaceId, name: f.name, type: f.type, options: opts, order: i };
  });
  const fieldByName = new Map(fields.map((f) => [f.name, f]));

  const views: View[] = (tpl.views ?? [{ name: "All Records", type: "table" as const }]).map((v) => {
    const groupField = v.groupByFieldName ? fieldByName.get(v.groupByFieldName) : undefined;
    return {
      id: uid(),
      spaceId,
      name: v.name,
      type: v.type,
      groupByFieldId: groupField?.id,
      visibleFieldIds: v.visibleFieldNames
        ? v.visibleFieldNames.map((n) => fieldByName.get(n)?.id).filter((x): x is string => !!x)
        : undefined,
      createdAt: now(),
      updatedAt: now(),
    };
  });

  const records = (tpl.starterRecords ?? []).map((r) => {
    const values: Record<string, unknown> = {};
    if (r.values) {
      for (const [fieldName, raw] of Object.entries(r.values)) {
        const f = fieldByName.get(fieldName);
        if (!f) continue;
        if (f.type === "select" && typeof raw === "string") {
          const opt = f.options?.find((o) => o.label === raw);
          if (opt) values[f.id] = opt.id;
        } else if (f.type === "multiSelect" && Array.isArray(raw)) {
          values[f.id] = raw
            .map((label) => f.options?.find((o) => o.label === label)?.id)
            .filter((x): x is string => !!x);
        } else {
          values[f.id] = raw;
        }
      }
    }
    return { title: r.title, values };
  });

  return { fields, views, records };
}

// Back-compat helper used elsewhere if needed
export function buildFieldsForTemplate(spaceId: string, templateKey: string): Field[] {
  return buildSeedForTemplate(spaceId, templateKey).fields;
}

export const DEFAULT_SPACE_KEYS = [
  "watchlist", "studyVault", "glowUp", "projectHub", "recipeBook", "memoryArchive", "wishlist",
];
