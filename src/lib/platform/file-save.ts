import { isTauri } from "@/lib/storage/storage-manager";

export interface SaveBlobOptions {
  suggestedName: string;
  filters?: { name: string; extensions: string[] }[];
}

export async function saveBlob(blob: Blob, options: SaveBlobOptions): Promise<boolean> {
  if (isTauri()) {
    const [{ save }, { writeFile }] = await Promise.all([
      import("@tauri-apps/plugin-dialog"),
      import("@tauri-apps/plugin-fs"),
    ]);
    const outputPath = await save({
      defaultPath: options.suggestedName,
      filters: options.filters,
    });

    if (!outputPath) {
      return false;
    }

    await writeFile(outputPath, new Uint8Array(await blob.arrayBuffer()));
    return true;
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = options.suggestedName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  return true;
}
