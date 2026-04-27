export function searchableRecordText(record: { title: string; tags?: string[]; properties?: Record<string, unknown> }): string {
  return [
    record.title,
    ...(record.tags ?? []),
    ...Object.values(record.properties ?? {}).map((value) => String(value ?? "")),
  ].join(" ").toLowerCase();
}
