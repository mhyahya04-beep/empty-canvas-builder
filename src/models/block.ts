import { z } from "zod";

export const BlockBaseSchema = z.object({
  id: z.string(),
  type: z.string(),
});

export const HeadingBlockSchema = BlockBaseSchema.extend({
  type: z.literal("heading"),
  level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  text: z.string(),
});

export const ParagraphBlockSchema = BlockBaseSchema.extend({
  type: z.literal("paragraph"),
  text: z.string(),
});

export const QuoteBlockSchema = BlockBaseSchema.extend({
  type: z.literal("quote"),
  text: z.string(),
  cite: z.string().optional(),
});

export const BulletListBlockSchema = BlockBaseSchema.extend({
  type: z.literal("bullet_list"),
  items: z.array(z.string()),
});

export const NumberedListBlockSchema = BlockBaseSchema.extend({
  type: z.literal("numbered_list"),
  items: z.array(z.string()),
});

export const TableBlockSchema = BlockBaseSchema.extend({
  type: z.literal("table"),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});

export const CalloutBlockSchema = BlockBaseSchema.extend({
  type: z.literal("callout"),
  variant: z.enum(["info", "warning", "success", "note"]),
  title: z.string().optional(),
  text: z.string(),
});

export const KeyValueListBlockSchema = BlockBaseSchema.extend({
  type: z.literal("key_value_list"),
  pairs: z.array(z.object({ key: z.string(), value: z.string() })),
});

export const DividerBlockSchema = BlockBaseSchema.extend({
  type: z.literal("divider"),
});

export const ImageBlockSchema = BlockBaseSchema.extend({
  type: z.literal("image"),
  src: z.string(),
  alt: z.string().optional(),
  caption: z.string().optional(),
});

export const LinkCardBlockSchema = BlockBaseSchema.extend({
  type: z.literal("link_card"),
  url: z.string(),
  title: z.string(),
  description: z.string().optional(),
  source: z.string().optional(),
});

export const PdfReferenceBlockSchema = BlockBaseSchema.extend({
  type: z.literal("pdf_reference"),
  title: z.string(),
  page: z.number().optional(),
  notes: z.string().optional(),
});

export const VerseBlockSchema = BlockBaseSchema.extend({
  type: z.literal("verse"),
  reference: z.string(),
  arabic: z.string().optional(),
  translation: z.string().optional(),
  summary: z.string().optional(),
});

export const ReflectionBlockSchema = BlockBaseSchema.extend({
  type: z.literal("reflection"),
  text: z.string(),
});

export const GlossaryTermBlockSchema = BlockBaseSchema.extend({
  type: z.literal("glossary_term"),
  term: z.string(),
  definition: z.string(),
});

export const BlockSchema = z.discriminatedUnion("type", [
  HeadingBlockSchema,
  ParagraphBlockSchema,
  QuoteBlockSchema,
  BulletListBlockSchema,
  NumberedListBlockSchema,
  TableBlockSchema,
  CalloutBlockSchema,
  KeyValueListBlockSchema,
  DividerBlockSchema,
  ImageBlockSchema,
  LinkCardBlockSchema,
  PdfReferenceBlockSchema,
  VerseBlockSchema,
  ReflectionBlockSchema,
  GlossaryTermBlockSchema,
]);

export type BlockBase = z.infer<typeof BlockBaseSchema>;
export type HeadingBlock = z.infer<typeof HeadingBlockSchema>;
export type ParagraphBlock = z.infer<typeof ParagraphBlockSchema>;
export type QuoteBlock = z.infer<typeof QuoteBlockSchema>;
export type BulletListBlock = z.infer<typeof BulletListBlockSchema>;
export type NumberedListBlock = z.infer<typeof NumberedListBlockSchema>;
export type TableBlock = z.infer<typeof TableBlockSchema>;
export type CalloutBlock = z.infer<typeof CalloutBlockSchema>;
export type KeyValueListBlock = z.infer<typeof KeyValueListBlockSchema>;
export type DividerBlock = z.infer<typeof DividerBlockSchema>;
export type ImageBlock = z.infer<typeof ImageBlockSchema>;
export type LinkCardBlock = z.infer<typeof LinkCardBlockSchema>;
export type PdfReferenceBlock = z.infer<typeof PdfReferenceBlockSchema>;
export type VerseBlock = z.infer<typeof VerseBlockSchema>;
export type ReflectionBlock = z.infer<typeof ReflectionBlockSchema>;
export type GlossaryTermBlock = z.infer<typeof GlossaryTermBlockSchema>;

export type Block = z.infer<typeof BlockSchema>;
