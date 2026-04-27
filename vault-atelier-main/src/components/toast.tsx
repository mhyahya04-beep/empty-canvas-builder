import { createContext, useContext, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

type Toast = { id: string; title: string; description?: string; variant?: "default" | "success" | "error" };
type Ctx = { toast: (t: Omit<Toast, "id">) => void };
const ToastCtx = createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const toast: Ctx["toast"] = (t) => {
    const id = Math.random().toString(36).slice(2);
    setItems((s) => [...s, { ...t, id }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 3500);
  };
  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 w-[320px]">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={`rounded-xl border bg-card/95 backdrop-blur px-4 py-3 shadow-lg ${
                t.variant === "error" ? "border-destructive/50" :
                t.variant === "success" ? "border-primary/40" : "border-border"
              }`}
            >
              <div className="text-sm font-medium text-foreground">{t.title}</div>
              {t.description && <div className="text-xs text-muted-foreground mt-0.5">{t.description}</div>}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
