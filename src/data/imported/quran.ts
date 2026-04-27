import { generateId } from "@/lib/utils/ids";
import { slugify } from "@/lib/utils/slug";
import { nowIso } from "@/lib/utils/dates";
import type { ContentItem } from "@/models/item";
import type { Block } from "@/models/block";

const ts = nowIso();
const quranYusufAliPdfUrl = new URL(
  "../../../content/assets/study-about/studying-quran/pdfs/The Holy Qur_an (Abdullah Yusuf Ali).pdf",
  import.meta.url,
).href;
const quranBilingualPdfUrl = new URL(
  "../../../content/assets/study-about/studying-quran/pdfs/The Holy Quran - Arabic Text and English Translation.pdf",
  import.meta.url,
).href;

type WithoutId<T> = T extends { id: string } ? Omit<T, "id"> : never;
type BlockInput = WithoutId<Block>;

function makeBlock(block: BlockInput): Block {
  return { id: generateId(), ...block } as Block;
}

export const quranSubject: ContentItem = {
  id: generateId(),
  title: "Studying Quran",
  slug: slugify("Studying Quran"),
  type: "subject",
  subjectId: null,
  parentId: null,
  tags: ["quran", "islam"],
  createdAt: ts,
  updatedAt: ts,
  status: "curated",
  pinned: false,
  archived: false,
  blocks: [],
};

export const surahNotes: ContentItem = {
  id: generateId(),
  title: "Surah Notes",
  slug: slugify("Surah Notes"),
  type: "note",
  subjectId: quranSubject.id,
  parentId: null,
  tags: ["surah", "tafsir"],
  createdAt: ts,
  updatedAt: ts,
  status: "curated",
  pinned: true,
  archived: false,
  description: "Structured study notes migrated from Notes_ Yahya.docx.",
  metadata: {
    origin: {
      type: "migration",
      originalFile: "Studying_ Quran/Notes_ Yahya.docx",
      importedAt: ts,
    },
  },
  blocks: [
    makeBlock({ type: "heading", level: 1, text: "Surah Al-Fatihah - Study Notes" }),
    makeBlock({
      type: "paragraph",
      text: `Al-Fatihah ("The Opening") is the first surah of the Quran. It is a foundational chapter recited in every unit of prayer.`,
    }),
    makeBlock({ type: "heading", level: 2, text: "Other Names" }),
    makeBlock({
      type: "bullet_list",
      items: [
        "Umm al-Kitab (Mother of the Book)",
        "As-Sab al-Mathani (The Seven Oft-Repeated)",
        "Ash-Shifa (The Cure)",
      ],
    }),
    makeBlock({ type: "heading", level: 2, text: "Themes and Context" }),
    makeBlock({
      type: "paragraph",
      text: "A complete supplication: praise of Allah, declaration of worship, and a request for guidance on the straight path.",
    }),
    makeBlock({
      type: "reflection",
      text: "Reciting this in every prayer is a daily reset - a reminder of who I am addressing and what I am asking for.",
    }),
  ],
};

export const quranPdf1: ContentItem = {
  id: generateId(),
  title: "The Holy Quran (Abdullah Yusuf Ali)",
  slug: slugify("The Holy Quran (Abdullah Yusuf Ali)"),
  type: "pdf_library_item",
  subjectId: quranSubject.id,
  parentId: null,
  tags: ["translation", "reference"],
  createdAt: ts,
  updatedAt: ts,
  status: "curated",
  pinned: false,
  archived: false,
  description: "Full Quran reference PDF - Abdullah Yusuf Ali translation.",
  metadata: {
    origin: {
      type: "migration",
      originalFile: "Studying_ Quran/The Holy Qur_an (Abdullah Yusuf Ali).pdf",
      importedAt: ts,
    },
    fileId: "seed-quran-yusuf-ali-translation",
    originalFilename: "The Holy Qur_an (Abdullah Yusuf Ali).pdf",
    seedAssetUrl: quranYusufAliPdfUrl,
    originalFormat: "pdf",
    category: "translation_reference",
    language: "English",
  },
  blocks: [
    makeBlock({
      type: "key_value_list",
      pairs: [
        { key: "Translator", value: "Abdullah Yusuf Ali" },
        { key: "Language", value: "English" },
      ],
    }),
  ],
};

export const quranPdf2: ContentItem = {
  id: generateId(),
  title: "The Holy Quran - Arabic Text and English Translation",
  slug: slugify("The Holy Quran - Arabic Text and English Translation"),
  type: "pdf_library_item",
  subjectId: quranSubject.id,
  parentId: null,
  tags: ["translation", "bilingual", "reference"],
  createdAt: ts,
  updatedAt: ts,
  status: "curated",
  pinned: false,
  archived: false,
  description: "Bilingual Quran reference PDF.",
  metadata: {
    origin: {
      type: "migration",
      originalFile: "Studying_ Quran/The Holy Quran - Arabic Text and English Translation.pdf",
      importedAt: ts,
    },
    fileId: "seed-quran-arabic-english-translation",
    originalFilename: "The Holy Quran - Arabic Text and English Translation.pdf",
    seedAssetUrl: quranBilingualPdfUrl,
    originalFormat: "pdf",
    category: "bilingual_reference",
    language: "Arabic + English",
  },
  blocks: [
    makeBlock({
      type: "key_value_list",
      pairs: [{ key: "Language", value: "Arabic + English" }],
    }),
  ],
};
