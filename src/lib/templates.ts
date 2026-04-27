import type { Field, View } from "./types";
import { now, uid } from "./db/db";
import { CREATE_WORKSPACE_PRESETS, getWorkspacePresetByKey, mapOptionsToFieldOptions } from "@/features/vault/definitions";
import { normalizeFieldShape } from "@/lib/migration/shape";

export interface TemplateDef {
  key: string;
  name: string;
  icon: string;
  description: string;
}

export const TEMPLATES: TemplateDef[] = CREATE_WORKSPACE_PRESETS.map((preset) => ({
  key: preset.key,
  name: preset.name,
  icon: preset.icon,
  description: preset.description,
}));

export interface TemplateSeed {
  fields: Field[];
  views: View[];
  records: { title: string; fields: Record<string, unknown> }[];
}

export function buildSeedForTemplate(workspaceId: string, tableId: string, templateKey: string): TemplateSeed {
  const preset = getWorkspacePresetByKey(templateKey);
  const primaryDatabase = preset?.databases[0];
  const fields: Field[] = (primaryDatabase?.fields ?? []).map((fieldPreset, index) =>
    normalizeFieldShape({
      id: uid(),
      key: fieldPreset.key,
      workspaceId,
      databaseId: tableId,
      tableId,
      name: fieldPreset.name,
      type: fieldPreset.type,
      options: mapOptionsToFieldOptions(fieldPreset.options),
      order: index,
      required: fieldPreset.required,
      hidden: fieldPreset.hidden,
      sensitive: fieldPreset.sensitive,
      description: fieldPreset.description,
    }),
  );

  return {
    fields,
    views: [
      {
        id: uid(),
        workspaceId,
        tableId,
        name: "All Records",
        type: "table",
        createdAt: now(),
        updatedAt: now(),
      },
    ],
    records: [],
  };
}

export function buildFieldsForTemplate(spaceId: string, templateKey: string): Field[] {
  return buildSeedForTemplate(spaceId, uid(), templateKey).fields;
}

export const DEFAULT_SPACE_KEYS = CREATE_WORKSPACE_PRESETS.map((preset) => preset.key);
