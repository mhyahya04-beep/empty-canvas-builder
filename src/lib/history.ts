import { useState, useEffect } from "react";

type HistoryEntry = { label?: string; undo?: () => Promise<void>; redo?: () => Promise<void> };
const undoStack: HistoryEntry[] = [];
const redoStack: HistoryEntry[] = [];

export const history = {
  push(entry: HistoryEntry, _key?: string) {
    undoStack.push(entry);
    // clear redo
    redoStack.length = 0;
  },
  async undo() {
    const e = undoStack.pop();
    if (!e || !e.undo) return null;
    await e.undo();
    redoStack.push(e);
    return e.label ?? null;
  },
  async redo() {
    const e = redoStack.pop();
    if (!e || !e.redo) return null;
    await e.redo();
    undoStack.push(e);
    return e.label ?? null;
  },
};

export function useUndoRedoHotkeys() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        // ctrl/cmd+z
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export function useHistoryState() {
  const [state, setState] = useState({ canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 });
  useEffect(() => {
    const id = setInterval(() => setState({ canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 }), 300);
    return () => clearInterval(id);
  }, []);
  return state;
}
