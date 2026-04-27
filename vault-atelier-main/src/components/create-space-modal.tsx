import { useState } from "react";
import { Modal } from "./modal";
import { TEMPLATES } from "@/lib/templates";
import { createSpaceFromTemplate } from "@/lib/storage";
import { useNavigate } from "@tanstack/react-router";
import { useToast } from "./toast";
import { cn } from "@/lib/utils";

export function CreateSpaceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tplKey, setTplKey] = useState("blank");
  const [name, setName] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const create = async () => {
    try {
      const space = await createSpaceFromTemplate(tplKey, name.trim() ? { name: name.trim() } : undefined);
      toast({ title: "Space created", description: space.name, variant: "success" });
      onClose();
      setName(""); setTplKey("blank");
      navigate({ to: "/space/$spaceId", params: { spaceId: space.id }, search: {} });
    } catch (e) {
      toast({ title: "Could not create space", description: (e as Error).message, variant: "error" });
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New Space" maxWidth="max-w-3xl"
      footer={
        <>
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-md hover:bg-muted">Cancel</button>
          <button onClick={create} className="px-4 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:opacity-90 font-medium">Create Space</button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-1.5">Name</label>
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Leave empty to use template name"
            className="w-full px-3 py-2 rounded-md bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-2">Template</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 max-h-[400px] overflow-y-auto pr-1">
            {TEMPLATES.map((t) => (
              <button
                key={t.key}
                onClick={() => setTplKey(t.key)}
                className={cn(
                  "text-left p-3.5 rounded-xl border transition-all hover:border-primary/60",
                  tplKey === t.key ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border bg-card"
                )}
              >
                <div className="text-2xl mb-1.5">{t.icon}</div>
                <div className="font-medium text-sm">{t.name}</div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
