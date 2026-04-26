import React, { useEffect, useState } from "react";
import { getUrgentItems } from "@/lib/storage";
import type { UrgentItem } from "@/lib/types";
import { AlertTriangle, ExternalLink } from "lucide-react";

export function UrgentList({ max = 10 }: { max?: number }) {
  const [items, setItems] = useState<UrgentItem[]>([]);

  useEffect(() => {
    let mounted = true;
    let t: any;
    async function load() {
      const it = await getUrgentItems();
      if (!mounted) return;
      setItems(it.slice(0, max));
    }
    load();
    t = setInterval(load, 3000);
    return () => { mounted = false; clearInterval(t); };
  }, [max]);

  if (!items.length) return (
    <div className="p-4 bg-card border border-border rounded">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">No urgent items</div>
    </div>
  );

  return (
    <div className="p-4 bg-card border border-border rounded">
      <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm">Urgent items</h3>
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id} className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="text-urgent mt-1"><AlertTriangle className="w-5 h-5" /></span>
              <div>
                <div className="text-sm font-medium">{it.message ?? 'Urgent'}</div>
                <div className="text-xs text-muted-foreground">{it.workspaceName ?? ''}{it.tableName ? ` • ${it.tableName}` : ''} • {it.sourceType}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                className="p-1 rounded hover:bg-muted text-muted-foreground"
                title="Open record"
                href={`/items/${it.sourceRef?.recordId}?urgentId=${encodeURIComponent(it.id)}&workspaceId=${encodeURIComponent(it.sourceRef?.workspaceId|| '')}&tableId=${encodeURIComponent(it.sourceRef?.tableId|| '')}`}
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default UrgentList;
