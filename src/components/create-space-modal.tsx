import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Modal } from "./modal";
import { createWorkspaceFromPreset, derivePresetForCreateModal } from "@/lib/storage";
import { useToast } from "./toast";
import { cn } from "@/lib/utils";

export function CreateSpaceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const presets = derivePresetForCreateModal();
  const [presetKey, setPresetKey] = useState(presets[0]?.key ?? "the-vault");
  const [name, setName] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const create = async () => {
    try {
      const workspace = await createWorkspaceFromPreset(presetKey, name.trim() ? { name: name.trim() } : undefined);
      toast({ title: "Workspace created", description: workspace.name, variant: "success" });
      onClose();
      setName("");
      setPresetKey(presets[0]?.key ?? "the-vault");
      navigate({ to: "/space/$spaceId", params: { spaceId: workspace.id } as any });
    } catch (error) {
      toast({ title: "Could not create workspace", description: (error as Error).message, variant: "error" });
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Workspace"
      maxWidth="max-w-3xl"
      footer={
        <>
          <button onClick={onClose} className="rounded-md px-3 py-1.5 text-sm hover:bg-muted">Cancel</button>
          <button onClick={create} className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">Create Workspace</button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">Name</label>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Leave empty to use the preset name"
            className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">Workspace Type</label>
          <div className="grid max-h-[420px] grid-cols-2 gap-2.5 overflow-y-auto pr-1 md:grid-cols-3">
            {presets.map((preset) => (
              <button
                key={preset.key}
                onClick={() => setPresetKey(preset.key)}
                className={cn(
                  "rounded-xl border p-3.5 text-left transition-all hover:border-primary/60",
                  presetKey === preset.key ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border bg-card",
                )}
              >
                <div className="mb-1.5 text-2xl">{preset.icon}</div>
                <div className="text-sm font-medium">{preset.name}</div>
                <div className="mt-1 line-clamp-3 text-xs text-muted-foreground">{preset.description}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
