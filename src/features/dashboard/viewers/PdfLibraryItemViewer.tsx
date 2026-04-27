import { useEffect, useState } from "react";
import type { ContentItem } from "@/models/item";
import { getPdfAttachmentMetadata } from "@/models/item-metadata";
import { BlocksList } from "@/components/blocks/BlockRenderer";
import { FileText, Download, ExternalLink } from "lucide-react";
import { fileStore } from "@/lib/files/file-store";
import { toSafeLocalAssetUrl } from "@/lib/utils/url-safety";

export function PdfLibraryItemViewer({ item }: { item: ContentItem }) {
  const attachment = getPdfAttachmentMetadata(item.metadata);
  const fileId = attachment?.fileId;
  const filename = attachment?.originalFilename ?? `${item.slug}.pdf`;
  const seedAssetUrl = attachment?.seedAssetUrl;
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let revoke: string | null = null;

    const resolvePdfUrl = async () => {
      if (!fileId) {
        setUrl(null);
        return;
      }

      const storedUrl = await fileStore.toUrl(fileId);
      if (storedUrl) {
        if (cancelled) {
          URL.revokeObjectURL(storedUrl);
          return;
        }

        setUrl(storedUrl);
        revoke = storedUrl;
        return;
      }

      const safeSeedAssetUrl = seedAssetUrl ? toSafeLocalAssetUrl(seedAssetUrl) : null;
      if (!safeSeedAssetUrl) {
        if (seedAssetUrl) {
          console.warn("Blocked unsafe seeded PDF asset URL", { fileId, seedAssetUrl });
        }
        setUrl(null);
        return;
      }

      try {
        const response = await fetch(safeSeedAssetUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch seed PDF (${response.status})`);
        }

        const seedBlob = await response.blob();
        const typedSeedBlob =
          seedBlob.type && seedBlob.type.length > 0
            ? seedBlob
            : new Blob([await seedBlob.arrayBuffer()], { type: "application/pdf" });

        await fileStore.save(fileId, typedSeedBlob);
        const seededUrl = URL.createObjectURL(typedSeedBlob);

        if (cancelled) {
          URL.revokeObjectURL(seededUrl);
          return;
        }

        setUrl(seededUrl);
        revoke = seededUrl;
      } catch (error) {
        console.warn("Unable to hydrate seeded PDF attachment", { fileId, seedAssetUrl, error });
        setUrl(null);
      }
    };

    resolvePdfUrl().catch((error) => {
      console.warn("Unexpected error while resolving PDF URL", { fileId, error });
      setUrl(null);
    });

    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [fileId, seedAssetUrl]);

  return (
    <div>
      {url ? (
        <div className="mb-6 overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/40 px-4 py-2 text-sm">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="font-medium">{filename}</span>
            </div>
            <div className="flex gap-1">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent"
              >
                <ExternalLink className="h-3 w-3" /> Open
              </a>
              <a
                href={url}
                download={filename}
                className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent"
              >
                <Download className="h-3 w-3" /> Download
              </a>
            </div>
          </div>
          <iframe src={url} title={item.title} className="h-[70vh] w-full bg-background" />
        </div>
      ) : (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/40 p-6">
          <FileText className="h-10 w-10 text-primary" />
          <div>
            <div className="font-medium">PDF library entry</div>
            <div className="text-xs text-muted-foreground">
              No local file attached. Use <strong>Import</strong> in the top bar to register a PDF,
              or edit this item's metadata.
            </div>
          </div>
        </div>
      )}
      <BlocksList blocks={item.blocks} />
    </div>
  );
}
