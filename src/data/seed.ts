import type { ContentItem } from "@/models/item";
import { getImportedSeedItems } from "./imported";

export function buildSeedItems(): ContentItem[] {
  // We now bootstrap from the modular imported data
  return getImportedSeedItems();
}
