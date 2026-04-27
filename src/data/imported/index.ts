import type { ContentItem } from "@/models/item";
import * as quran from "./quran";
import * as cs from "./cs";
import * as links from "./links";

export function getImportedSeedItems(): ContentItem[] {
  return [
    // Quran
    quran.quranSubject,
    quran.surahNotes,
    quran.quranPdf1,
    quran.quranPdf2,

    // CS
    cs.csSubject,
    cs.csResources,

    // Links (Arabic)
    links.arabic.subject,
    links.arabic.collection,

    // Links (Perfumes)
    links.perfumes.subject,
    links.perfumes.collection,

    // Links (Theory)
    links.theory.subject,
    links.theory.collection,

    // Links (Geography)
    links.geography.subject,
    links.geography.collection,
  ];
}
