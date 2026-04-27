import { generateId } from "@/lib/utils/ids";
import { slugify } from "@/lib/utils/slug";
import { nowIso } from "@/lib/utils/dates";
import type { ContentItem } from "@/models/item";
import type { Block } from "@/models/block";

const ts = nowIso();
type WithoutId<T> = T extends { id: string } ? Omit<T, "id"> : never;
type BlockInput = WithoutId<Block>;

function makeBlock(block: BlockInput): Block {
  return { id: generateId(), ...block } as Block;
}

export const csSubject: ContentItem = {
  id: generateId(),
  title: "Computer Science",
  slug: slugify("Computer Science"),
  type: "subject",
  subjectId: null,
  parentId: null,
  tags: ["cs", "programming"],
  createdAt: ts,
  updatedAt: ts,
  status: "curated",
  pinned: false,
  archived: false,
  blocks: [],
};

export const csResources: ContentItem = {
  id: generateId(),
  title: "Learning Resources",
  slug: slugify("Learning Resources"),
  type: "resource_list",
  subjectId: csSubject.id,
  parentId: null,
  tags: ["learning", "resources"],
  createdAt: ts,
  updatedAt: ts,
  status: "curated",
  pinned: true,
  archived: false,
  description: "Grouped list of learning materials from Resources.docx.",
  metadata: {
    origin: {
      type: "migration",
      originalFile: "Computer Science/Resources.docx",
      importedAt: ts,
    },
    groups: [
      {
        name: "Frameworks",
        items: [
          "React",
          "Vue",
          "Ruby on Rails",
          "Next.js",
          "Angular",
          "Django",
          "Flask",
          "Laravel",
          "Spring Boot",
          "Flutter",
          "Bootstrap",
          "Tailwind CSS",
        ],
      },
      {
        name: "Programming Languages",
        items: [
          "HTML",
          "CSS",
          "JavaScript",
          "Python",
          "TypeScript",
          "Java",
          "Ruby",
          "C",
          "C++",
          "C#",
          "PHP",
          "Swift",
          "Kotlin",
          "Rust",
          "Dart",
          "R",
          "Perl",
          "Scala",
          "Haskell",
          "Julia",
          "Elixir",
        ],
      },
      {
        name: "Tools / Development",
        items: [
          "Git",
          "API",
          "REST",
          "Microservices",
          "Backend",
          "DevOps",
          "Full Stack",
          "Cloud",
          "Unity",
          "Unreal Engine",
        ],
      },
    ],
  },
  blocks: [
    makeBlock({
      type: "paragraph",
      text: "A comprehensive collection of frameworks, languages, and tools for modern software development.",
    }),
  ],
};
