// Session-local undo/redo stack. Not persisted — wipes on page reload.
export type Action = {
  label: string;
  at: number;
  undo: () => Promise<void> | void;
  redo: () => Promise<void> | void;
};

const MAX_HISTORY = 200;
const past: Action[] = [];
const future: Action[] = [];
const listeners = new Set<() => void>();

let coalesceKey: string | null = null;
let coalesceTimer: number | null = null;

function notify() {
  for (const l of listeners) l();
}

export const history = {
  /**
   * Push a new action onto the undo stack. Pass coalesceKey to merge
   * rapid successive edits (e.g. typing in a cell) into one history entry —
   * only the very first action's `undo` is preserved while `redo` advances
   * to the latest. The window resets after 600ms of inactivity.
   */
  push(action: Omit<Action, "at"> & { at?: number }, coalesce?: string) {
    const a: Action = { ...action, at: action.at ?? Date.now() };
    if (coalesce && coalesceKey === coalesce && past.length > 0) {
      const last = past[past.length - 1];
      // keep last.undo (oldest state), update redo to new state
      past[past.length - 1] = { label: last.label, at: a.at, undo: last.undo, redo: a.redo };
    } else {
      past.push(a);
      if (past.length > MAX_HISTORY) past.shift();
    }
    future.length = 0;
    if (coalesce) {
      coalesceKey = coalesce;
      if (coalesceTimer) window.clearTimeout(coalesceTimer);
      coalesceTimer = window.setTimeout(() => { coalesceKey = null; }, 600);
    } else {
      coalesceKey = null;
    }
    notify();
  },
  async undo() {
    const a = past.pop();
    if (!a) return null;
    coalesceKey = null;
    try { await a.undo(); } catch (e) { console.error("Undo failed", e); }
    future.push(a);
    notify();
    return a.label;
  },
  async redo() {
    const a = future.pop();
    if (!a) return null;
    coalesceKey = null;
    try { await a.redo(); } catch (e) { console.error("Redo failed", e); }
    past.push(a);
    notify();
    return a.label;
  },
  /** Undo multiple steps until (and including) the given index in the past stack. */
  async undoTo(index: number) {
    while (past.length - 1 >= index) {
      const a = past.pop();
      if (!a) break;
      try { await a.undo(); } catch (e) { console.error("Undo failed", e); }
      future.push(a);
    }
    coalesceKey = null;
    notify();
  },
  async redoTo(index: number) {
    // index is in current "future" (top of stack to bottom). Redo until that step is applied.
    while (future.length - 1 >= index) {
      const a = future.pop();
      if (!a) break;
      try { await a.redo(); } catch (e) { console.error("Redo failed", e); }
      past.push(a);
    }
    coalesceKey = null;
    notify();
  },
  past() { return past.slice(); },
  future() { return future.slice(); },
  canUndo() { return past.length > 0; },
  canRedo() { return future.length > 0; },
  clear() { past.length = 0; future.length = 0; coalesceKey = null; notify(); },
  subscribe(fn: () => void) { listeners.add(fn); return () => listeners.delete(fn); },
};
