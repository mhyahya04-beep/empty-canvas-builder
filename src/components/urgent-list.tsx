import React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/db";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Clock, Box, FileText, CheckSquare, Highlighter } from "lucide-react";
import { cn, formatRelative } from "@/lib/utils";
import { motion } from "framer-motion";
import type { UrgentItem } from "@/lib/types";

export function UrgentList({ max = 5 }: { max?: number }) {
  const items = useLiveQuery(
    () => db.urgentItems.orderBy("priority").reverse().limit(max).toArray(),
    [max]
  ) ?? [];

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border/50 p-8 text-center bg-card/10">
        <p className="text-sm text-muted-foreground italic">No urgent items requiring immediate attention.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((it, idx) => (
        <UrgentCard key={it.id} item={it} index={idx} />
      ))}
    </div>
  );
}

function UrgentCard({ item, index }: { item: UrgentItem; index: number }) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'checklist': return <CheckSquare className="w-3.5 h-3.5" />;
      case 'highlightedText': return <Highlighter className="w-3.5 h-3.5" />;
      case 'deadline': return <Clock className="w-3.5 h-3.5" />;
      case 'property': return <Box className="w-3.5 h-3.5" />;
      default: return <FileText className="w-3.5 h-3.5" />;
    }
  };

  const getPriorityColor = (p: number) => {
    if (p >= 2) return "text-rose-500 bg-rose-500/10 border-rose-500/20";
    return "text-amber-500 bg-amber-500/10 border-amber-500/20";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link
        to="/items/$itemId"
        params={{ itemId: item.sourceRef.recordId } as any}
        className="group block p-4 rounded-xl border border-border bg-card/50 hover:bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all h-full"
      >
        <div className="flex items-start justify-between mb-3">
          <div className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1.5", getPriorityColor(item.priority))}>
            <AlertTriangle className="w-3 h-3" />
            {item.priority >= 2 ? "High Priority" : "Urgent"}
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">
            {formatRelative(item.createdAt)}
          </span>
        </div>

        <h4 className="text-sm font-semibold mb-2 line-clamp-2 group-hover:text-primary transition-colors">
          {item.message}
        </h4>

        <div className="mt-auto pt-3 border-t border-border/30 flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="p-1 rounded bg-muted text-muted-foreground">
              {getIcon(item.sourceType)}
            </div>
            <span className="text-[10px] text-muted-foreground truncate uppercase tracking-tight font-medium">
              {item.workspaceName || "Vault"} {item.tableName ? `• ${item.tableName}` : ""}
            </span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
        </div>
      </Link>
    </motion.div>
  );
}

export default UrgentList;
