import type { ContentItem } from "@/models/item";
import { getSavedLinks } from "@/models/item-metadata";
import { BlocksList } from "@/components/blocks/BlockRenderer";
import { ExternalLink } from "lucide-react";
import { toSafeWebHref } from "@/lib/utils/url-safety";

export function LinkCollectionViewer({ item }: { item: ContentItem }) {
  const links = getSavedLinks(item.metadata);

  return (
    <div>
      <BlocksList blocks={item.blocks} />
      <div className="mt-6 space-y-3">
        {links.map((l, i) => {
          const safeHref = toSafeWebHref(l.url);
          const content = (
            <>
              <div className="min-w-0">
                <div className="font-medium">{l.title}</div>
                {l.source && (
                  <div className="mt-0.5 text-xs uppercase tracking-wider text-muted-foreground">
                    {l.source}
                  </div>
                )}
                {l.note && <div className="mt-1 text-sm text-muted-foreground">{l.note}</div>}
                <div className="mt-1 truncate text-xs text-primary">{l.url}</div>
                {!safeHref && (
                  <div className="mt-1 text-xs font-medium text-destructive">
                    Blocked unsafe URL
                  </div>
                )}
              </div>
              {safeHref && <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />}
            </>
          );

          if (!safeHref) {
            return (
              <div
                key={i}
                className="flex items-start justify-between gap-3 rounded-md border border-dashed border-destructive/40 bg-destructive/5 p-4 text-destructive"
              >
                {content}
              </div>
            );
          }

          return (
            <a
              key={i}
              href={safeHref}
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-start justify-between gap-3 rounded-md border border-border bg-card p-4 transition hover:border-primary/40 hover:bg-accent/40"
            >
              {content}
            </a>
          );
        })}
      </div>
    </div>
  );
}
