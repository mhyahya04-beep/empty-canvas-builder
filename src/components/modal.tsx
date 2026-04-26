import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

export function Modal({ open, onClose, title, children, footer, maxWidth = "max-w-lg", }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; footer?: ReactNode; maxWidth?: string; }) {
  useEffect(() => { if (!open) return; const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }} transition={{ duration: 0.18 }} className={`w-full ${maxWidth} bg-card border border-border rounded-2xl shadow-2xl overflow-hidden`} onClick={(e) => e.stopPropagation()}>
            {title && (
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h2 className="text-lg font-display font-semibold">{title}</h2>
                <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
              </div>
            )}
            <div className="px-6 py-5">{children}</div>
            {footer && <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-end gap-2">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Confirm({ open, onClose, onConfirm, title, description, confirmText = "Confirm", destructive, }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; description?: string; confirmText?: string; destructive?: boolean; }) {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-sm" footer={
      <>
        <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-md hover:bg-muted">Cancel</button>
        <button onClick={() => { onConfirm(); onClose(); }} className={`px-3 py-1.5 text-sm rounded-md font-medium ${destructive ? "bg-destructive text-destructive-foreground hover:opacity-90" : "bg-primary text-primary-foreground hover:opacity-90"}`}>{confirmText}</button>
      </>
    }>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </Modal>
  );
}

export function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; window.addEventListener("mousedown", fn); return () => window.removeEventListener("mousedown", fn); }, [open]);
  return { open, setOpen, ref };
}
