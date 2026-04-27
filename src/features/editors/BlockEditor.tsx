import { useState } from "react";
import { ChevronUp, ChevronDown, Trash2, Plus } from "lucide-react";
import type { Block } from "@/models/block";
import { generateId } from "@/lib/utils/ids";

interface Props {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
}

const BLOCK_OPTIONS: { type: Block["type"]; label: string }[] = [
  { type: "heading", label: "Heading" },
  { type: "paragraph", label: "Paragraph" },
  { type: "quote", label: "Quote" },
  { type: "bullet_list", label: "Bullet list" },
  { type: "numbered_list", label: "Numbered list" },
  { type: "callout", label: "Callout" },
  { type: "key_value_list", label: "Key/value list" },
  { type: "divider", label: "Divider" },
  { type: "verse", label: "Verse" },
  { type: "reflection", label: "Reflection" },
  { type: "glossary_term", label: "Glossary term" },
  { type: "link_card", label: "Link card" },
  { type: "pdf_reference", label: "PDF reference" },
  { type: "table", label: "Table" },
  { type: "image", label: "Image" },
];

function emptyBlock(type: Block["type"]): Block {
  const id = generateId();
  switch (type) {
    case "heading":
      return { id, type, level: 2, text: "" };
    case "paragraph":
      return { id, type, text: "" };
    case "quote":
      return { id, type, text: "" };
    case "bullet_list":
      return { id, type, items: [""] };
    case "numbered_list":
      return { id, type, items: [""] };
    case "callout":
      return { id, type, variant: "info", text: "" };
    case "key_value_list":
      return { id, type, pairs: [{ key: "", value: "" }] };
    case "divider":
      return { id, type };
    case "verse":
      return { id, type, reference: "", translation: "" };
    case "reflection":
      return { id, type, text: "" };
    case "glossary_term":
      return { id, type, term: "", definition: "" };
    case "link_card":
      return { id, type, url: "", title: "" };
    case "pdf_reference":
      return { id, type, title: "" };
    case "table":
      return { id, type, headers: [""], rows: [[""]] };
    case "image":
      return { id, type, src: "" };
  }
}

export function BlockEditor({ blocks, onChange }: Props) {
  const [adding, setAdding] = useState(false);

  const update = (idx: number, next: Block) => {
    const copy = blocks.slice();
    copy[idx] = next;
    onChange(copy);
  };
  const remove = (idx: number) => onChange(blocks.filter((_, i) => i !== idx));
  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= blocks.length) return;
    const copy = blocks.slice();
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    onChange(copy);
  };
  const add = (type: Block["type"]) => {
    onChange([...blocks, emptyBlock(type)]);
    setAdding(false);
  };

  return (
    <div className="space-y-3">
      {blocks.map((b, i) => (
        <div key={b.id} className="group rounded-md border border-border bg-card/40 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {b.type.replace("_", " ")}
            </div>
            <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
              <IconBtn onClick={() => move(i, -1)} title="Move up">
                <ChevronUp className="h-3.5 w-3.5" />
              </IconBtn>
              <IconBtn onClick={() => move(i, 1)} title="Move down">
                <ChevronDown className="h-3.5 w-3.5" />
              </IconBtn>
              <IconBtn onClick={() => remove(i)} title="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </IconBtn>
            </div>
          </div>
          <BlockFields block={b} onChange={(next) => update(i, next)} />
        </div>
      ))}

      {adding ? (
        <div className="rounded-md border border-dashed border-border p-3">
          <div className="mb-2 text-xs text-muted-foreground">Add block</div>
          <div className="flex flex-wrap gap-1.5">
            {BLOCK_OPTIONS.map((o) => (
              <button
                type="button"
                key={o.type}
                onClick={() => add(o.type)}
                className="rounded-md border border-border px-2 py-1 text-xs hover:border-primary/40 hover:bg-accent"
              >
                {o.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="ml-auto rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-2 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Add block
        </button>
      )}
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}

const inputCls =
  "w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30";

function BlockFields({ block, onChange }: { block: Block; onChange: (b: Block) => void }) {
  switch (block.type) {
    case "heading":
      return (
        <div className="flex gap-2">
          <select
            value={block.level}
            onChange={(e) => onChange({ ...block, level: Number(e.target.value) as 1 | 2 | 3 | 4 })}
            className={`${inputCls} w-20`}
          >
            {[1, 2, 3, 4].map((l) => (
              <option key={l} value={l}>
                H{l}
              </option>
            ))}
          </select>
          <input
            className={inputCls}
            value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            placeholder="Heading text"
          />
        </div>
      );
    case "paragraph":
      return (
        <textarea
          className={`${inputCls} min-h-[80px]`}
          value={block.text}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
          placeholder="Write a paragraph..."
        />
      );
    case "quote":
      return (
        <div className="space-y-2">
          <textarea
            className={`${inputCls} min-h-[60px]`}
            value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            placeholder="Quote text"
          />
          <input
            className={inputCls}
            value={block.cite ?? ""}
            onChange={(e) => onChange({ ...block, cite: e.target.value })}
            placeholder="Citation (optional)"
          />
        </div>
      );
    case "bullet_list":
    case "numbered_list":
      return (
        <ListItemsEditor items={block.items} onChange={(items) => onChange({ ...block, items })} />
      );
    case "callout":
      return (
        <div className="space-y-2">
          <div className="flex gap-2">
            <select
              className={`${inputCls} w-32`}
              value={block.variant}
              onChange={(e) =>
                onChange({
                  ...block,
                  variant: e.target.value as "info" | "warning" | "success" | "note",
                })
              }
            >
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="success">Success</option>
              <option value="note">Note</option>
            </select>
            <input
              className={inputCls}
              value={block.title ?? ""}
              onChange={(e) => onChange({ ...block, title: e.target.value })}
              placeholder="Title (optional)"
            />
          </div>
          <textarea
            className={`${inputCls} min-h-[60px]`}
            value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
          />
        </div>
      );
    case "key_value_list":
      return (
        <div className="space-y-2">
          {block.pairs.map((p, i) => (
            <div key={i} className="flex gap-2">
              <input
                className={`${inputCls} w-1/3`}
                value={p.key}
                onChange={(e) => {
                  const pairs = block.pairs.slice();
                  pairs[i] = { ...p, key: e.target.value };
                  onChange({ ...block, pairs });
                }}
                placeholder="Key"
              />
              <input
                className={inputCls}
                value={p.value}
                onChange={(e) => {
                  const pairs = block.pairs.slice();
                  pairs[i] = { ...p, value: e.target.value };
                  onChange({ ...block, pairs });
                }}
                placeholder="Value"
              />
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-destructive"
                aria-label="Remove pair"
                onClick={() => onChange({ ...block, pairs: block.pairs.filter((_, j) => j !== i) })}
              >
                x
              </button>
            </div>
          ))}
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={() => onChange({ ...block, pairs: [...block.pairs, { key: "", value: "" }] })}
          >
            + Add pair
          </button>
        </div>
      );
    case "divider":
      return <div className="text-xs text-muted-foreground">Horizontal divider</div>;
    case "verse":
      return (
        <div className="space-y-2">
          <input
            className={inputCls}
            value={block.reference}
            onChange={(e) => onChange({ ...block, reference: e.target.value })}
            placeholder="Reference (e.g. 1:1)"
          />
          <textarea
            dir="rtl"
            className={`${inputCls} font-serif text-lg min-h-[60px]`}
            value={block.arabic ?? ""}
            onChange={(e) => onChange({ ...block, arabic: e.target.value })}
            placeholder="Arabic (optional)"
          />
          <textarea
            className={`${inputCls} min-h-[60px]`}
            value={block.translation ?? ""}
            onChange={(e) => onChange({ ...block, translation: e.target.value })}
            placeholder="Translation"
          />
          <textarea
            className={`${inputCls} min-h-[40px]`}
            value={block.summary ?? ""}
            onChange={(e) => onChange({ ...block, summary: e.target.value })}
            placeholder="Summary / notes"
          />
        </div>
      );
    case "reflection":
      return (
        <textarea
          className={`${inputCls} min-h-[80px]`}
          value={block.text}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
          placeholder="Personal reflection..."
        />
      );
    case "glossary_term":
      return (
        <div className="space-y-2">
          <input
            className={inputCls}
            value={block.term}
            onChange={(e) => onChange({ ...block, term: e.target.value })}
            placeholder="Term"
          />
          <textarea
            className={`${inputCls} min-h-[60px]`}
            value={block.definition}
            onChange={(e) => onChange({ ...block, definition: e.target.value })}
            placeholder="Definition"
          />
        </div>
      );
    case "link_card":
      return (
        <div className="space-y-2">
          <input
            className={inputCls}
            value={block.title}
            onChange={(e) => onChange({ ...block, title: e.target.value })}
            placeholder="Title"
          />
          <input
            className={inputCls}
            value={block.url}
            onChange={(e) => onChange({ ...block, url: e.target.value })}
            placeholder="https://..."
          />
          <input
            className={inputCls}
            value={block.description ?? ""}
            onChange={(e) => onChange({ ...block, description: e.target.value })}
            placeholder="Description"
          />
        </div>
      );
    case "pdf_reference":
      return (
        <div className="space-y-2">
          <input
            className={inputCls}
            value={block.title}
            onChange={(e) => onChange({ ...block, title: e.target.value })}
            placeholder="PDF title"
          />
          <div className="flex gap-2">
            <input
              type="number"
              className={`${inputCls} w-24`}
              value={block.page ?? ""}
              onChange={(e) =>
                onChange({ ...block, page: e.target.value ? Number(e.target.value) : undefined })
              }
              placeholder="Page"
            />
            <input
              className={inputCls}
              value={block.notes ?? ""}
              onChange={(e) => onChange({ ...block, notes: e.target.value })}
              placeholder="Notes"
            />
          </div>
        </div>
      );
    case "table":
      return (
        <TableEditor
          headers={block.headers}
          rows={block.rows}
          onChange={(next) => onChange({ ...block, ...next })}
        />
      );
    case "image":
      return (
        <div className="space-y-2">
          <input
            className={inputCls}
            value={block.src}
            onChange={(e) => onChange({ ...block, src: e.target.value })}
            placeholder="Image URL (https://...)"
          />
          <input
            className={inputCls}
            value={block.alt ?? ""}
            onChange={(e) => onChange({ ...block, alt: e.target.value })}
            placeholder="Alt text"
          />
          <input
            className={inputCls}
            value={block.caption ?? ""}
            onChange={(e) => onChange({ ...block, caption: e.target.value })}
            placeholder="Caption (optional)"
          />
        </div>
      );
  }
}

function TableEditor({
  headers,
  rows,
  onChange,
}: {
  headers: string[];
  rows: string[][];
  onChange: (next: { headers: string[]; rows: string[][] }) => void;
}) {
  const updateHeader = (idx: number, val: string) => {
    const next = [...headers];
    next[idx] = val;
    onChange({ headers: next, rows });
  };
  const updateCell = (r: number, c: number, val: string) => {
    const next = rows.map((row, ri) =>
      ri === r ? row.map((cell, ci) => (ci === c ? val : cell)) : row,
    );
    onChange({ headers, rows: next });
  };
  const addCol = () => onChange({ headers: [...headers, ""], rows: rows.map((r) => [...r, ""]) });
  const addRow = () => onChange({ headers, rows: [...rows, headers.map(() => "")] });
  const removeCol = (idx: number) =>
    onChange({
      headers: headers.filter((_, i) => i !== idx),
      rows: rows.map((r) => r.filter((_, i) => i !== idx)),
    });
  const removeRow = (idx: number) => onChange({ headers, rows: rows.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="border border-border p-1 bg-muted/30">
                <div className="flex gap-1">
                  <input
                    className="w-full bg-transparent p-0.5 outline-none focus:bg-background"
                    value={h}
                    onChange={(e) => updateHeader(i, e.target.value)}
                    placeholder={`H${i + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeCol(i)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Remove column ${i + 1}`}
                  >
                    x
                  </button>
                </div>
              </th>
            ))}
            <th className="p-1">
              <button type="button" onClick={addCol} className="text-primary hover:underline">
                +
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} className="border border-border p-1">
                  <input
                    className="w-full bg-transparent p-0.5 outline-none focus:bg-background"
                    value={cell}
                    onChange={(e) => updateCell(ri, ci, e.target.value)}
                  />
                </td>
              ))}
              <td className="p-1">
                <button
                  type="button"
                  onClick={() => removeRow(ri)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Remove row ${ri + 1}`}
                >
                  x
                </button>
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={headers.length + 1} className="p-1">
              <button type="button" onClick={addRow} className="text-primary hover:underline">
                + Add row
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ListItemsEditor({
  items,
  onChange,
}: {
  items: string[];
  onChange: (items: string[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <div key={i} className="flex gap-2">
          <input
            className={inputCls}
            value={it}
            onChange={(e) => {
              const copy = items.slice();
              copy[i] = e.target.value;
              onChange(copy);
            }}
            placeholder={`Item ${i + 1}`}
          />
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-destructive"
            aria-label={`Remove item ${i + 1}`}
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            x
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-xs text-primary hover:underline"
        onClick={() => onChange([...items, ""])}
      >
        + Add item
      </button>
    </div>
  );
}
