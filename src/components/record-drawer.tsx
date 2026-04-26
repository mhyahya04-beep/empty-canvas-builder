import { AnimatePresence, motion } from "framer-motion";
import { DocumentEditor } from "./document-editor";

export function RecordDrawer({ recordId, onClose }: { recordId: string | null; onClose: () => void }) {
  const open = !!recordId;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 280, damping: 32 }} className={"fixed top-0 right-0 z-50 h-full bg-card border-l border-border shadow-2xl flex flex-col w-full md:w-[680px] lg:w-[760px]"}> 
            <DocumentEditor recordId={recordId} onClose={onClose} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
