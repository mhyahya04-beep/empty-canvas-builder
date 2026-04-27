import { useEffect, useState } from "react";
import { history } from "@/lib/history";
import { useToast } from "@/components/toast";

/** Global keyboard shortcuts for undo (Cmd/Ctrl+Z) and redo (Cmd/Ctrl+Shift+Z, Cmd/Ctrl+Y). */
export function useUndoRedoHotkeys() {
  const { toast } = useToast();
  useEffect(() => {
    const fn = async (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const key = e.key.toLowerCase();
      // never hijack typing inside contentEditable rich text — Tiptap manages its own undo.
      const t = e.target as HTMLElement | null;
      if (t?.isContentEditable) return;
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        const label = await history.undo();
        if (label) toast({ title: "Undid: " + label, variant: "default" });
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        const label = await history.redo();
        if (label) toast({ title: "Redid: " + label, variant: "default" });
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [toast]);
}

/** Subscribe to history availability for UI badges. */
export function useHistoryState() {
  const [, force] = useState(0);
  useEffect(() => { const off = history.subscribe(() => force((n) => n + 1)); return () => { off; }; }, []);
  return { canUndo: history.canUndo(), canRedo: history.canRedo() };
}
