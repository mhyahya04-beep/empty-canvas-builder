import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { RichTextEditor } from "./rich-editor";

export function FullScreenDocument({ open, initialJSON, onClose, onChange }: { open: boolean; initialJSON: any; onClose: () => void; onChange: (j: any) => void; }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-6">
          <motion.div initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} className="w-full max-w-5xl h-[90vh] bg-card rounded-lg shadow-lg overflow-auto">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border">
              <div className="text-sm text-muted-foreground">Full Screen Document</div>
              <div className="flex items-center gap-2">
                <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="p-6 h-full">
              <RichTextEditor initialJSON={initialJSON} onChange={onChange} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
