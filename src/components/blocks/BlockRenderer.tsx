import { FileText, Quote } from "lucide-react";

export function BlockRenderer({ block }: { block: any }) {
  switch (block.type) {
    case "heading": {
      const sizes = ["", "text-4xl", "text-3xl", "text-2xl", "text-xl"] as const;
      const HeadingTag = `h${block.level}` as "h1" | "h2" | "h3" | "h4";

      return (
        <HeadingTag className={`mb-4 mt-10 font-serif font-bold tracking-tight text-foreground ${sizes[block.level]}`}>
          {block.text}
        </HeadingTag>
      );
    }
    case "paragraph":
      return <p className="my-4 leading-loose text-foreground/80 md:text-lg">{block.text}</p>;
    case "quote":
      return (
        <blockquote className="my-8 border-l-[3px] border-primary/40 pl-6">
          <div className="font-serif text-xl italic leading-relaxed text-foreground/70">"{block.text}"</div>
        </blockquote>
      );
    default:
      return null;
  }
}

export function BlocksList({ blocks }: { blocks: any[] }) {
  return (
    <div>
      {blocks.map((block) => (
        <BlockRenderer key={block.id} block={block} />
      ))}
    </div>
  );
}
