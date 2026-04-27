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

const createLinkCollection = (
  subjectTitle: string,
  tag: string,
  originalFile: string,
): { subject: ContentItem; collection: ContentItem } => {
  const subject: ContentItem = {
    id: generateId(),
    title: subjectTitle,
    slug: slugify(subjectTitle),
    type: "subject",
    subjectId: null,
    parentId: null,
    tags: [tag],
    createdAt: ts,
    updatedAt: ts,
    status: "curated",
    pinned: false,
    archived: false,
    blocks: [],
  };

  const collection: ContentItem = {
    id: generateId(),
    title: "Saved References",
    slug: slugify("Saved References"),
    type: "link_collection",
    subjectId: subject.id,
    parentId: null,
    tags: [tag, "saved"],
    createdAt: ts,
    updatedAt: ts,
    status: "curated",
    pinned: false,
    archived: false,
    description: `Saved links and references migrated from ${originalFile}.`,
    metadata: {
      origin: {
        type: "migration",
        originalFile,
        importedAt: ts,
      },
      links: [
        {
          url: "https://instagram.com/",
          title: "Instagram Reference",
          source: "Instagram",
          note: "Reference link extracted from document.",
        },
      ],
    },
    blocks: [
      makeBlock({
        type: "paragraph",
        text: "Saved references and research links for further study.",
      }),
    ],
  };

  return { subject, collection };
};

export const arabic = createLinkCollection("Arabic", "arabic", "Arabic/Untitled document.docx");
export const perfumes = createLinkCollection(
  "Perfumes",
  "perfumes",
  "Perfumes/Untitled document.docx",
);
export const theory = createLinkCollection(
  "Theory Studies",
  "theory",
  "Theory Studies/Untitled document.docx",
);
export const geography = createLinkCollection(
  "Geography",
  "geography",
  "Geography/Untitled document.docx",
);
