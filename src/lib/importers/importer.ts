import type { ContentItem } from "@/models/item";

export interface ImportResult {
  items: ContentItem[];
  warnings: string[];
}

export interface Importer<TInput = unknown> {
  readonly id: string;
  readonly label: string;
  canHandle(input: TInput): boolean;
  import(input: TInput): Promise<ImportResult>;
}
