import { Link } from "@tanstack/react-router";
import { Pin } from "lucide-react";
import type { ContentItem } from "@/models/item";
import { StatusBadge, TypeBadge } from "./StatusBadge";
import { formatDate } from "@/lib/utils/dates";

export function ItemCard({ item }: { item: ContentItem }) {
  return (
    <Link
      to="/items/$itemId"
      params={{ itemId: item.id }}
      className="premium-card group flex flex-col gap-3 rounded-xl border border-border bg-card p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={item.type} />
          {item.pinned && (
            <div
              aria-label="Pinned"
              className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary"
            >
              <Pin className="h-3 w-3 fill-primary" />
            </div>
          )}
        </div>
        <StatusBadge status={item.status} />
      </div>
      <div className="space-y-1">
        <div className="font-serif text-xl font-semibold leading-tight text-foreground group-hover:text-primary decoration-primary/30 group-hover:underline underline-offset-4">
          {item.title}
        </div>
        {item.description && (
          <div className="line-clamp-2 text-sm leading-relaxed text-muted-foreground/80">
            {item.description}
          </div>
        )}
      </div>
      <div className="mt-auto flex items-center justify-between pt-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
        <span>{formatDate(item.updatedAt)}</span>
        <div className="flex gap-2">
          {item.tags.slice(0, 2).map((t) => (
            <span key={t} className="rounded bg-muted px-1.5 py-0.5">
              #{t}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
