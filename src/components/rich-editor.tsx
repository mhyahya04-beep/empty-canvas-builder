import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Image from "@tiptap/extension-image";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Highlight from "@tiptap/extension-highlight";
import { Bold, Italic, Underline as UnderlineIcon, Type, List, ListOrdered, CheckSquare, Quote, Table as TableIcon, Link as LinkIcon, Image as ImageIcon } from "lucide-react";

type RichEditorHandle = { insertImage: (src: string) => void };

export const RichTextEditor = forwardRef(function RichTextEditor(
  { initialJSON, onChange, placeholder = "Write…" }: { initialJSON: unknown; onChange: (json: unknown) => void; placeholder?: string; },
  ref: React.Ref<RichEditorHandle | null>,
) {
  const fileRef = useRef<HTMLInputElement | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({ autolink: true, openOnClick: false }),
      Placeholder.configure({ placeholder }),
      Underline,
      Image,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem,
      HorizontalRule,
      Highlight.configure({ multicolor: false }),
    ],
    content: initialJSON ?? "",
    editorProps: { attributes: { class: "tiptap-doc prose prose-sm sm:prose lg:prose-lg" } },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });

  // expose imperative insert
  useImperativeHandle(ref, () => ({
    insertImage: (src: string) => {
      if (!editor) return;
      editor.chain().focus().setImage({ src }).run();
    },
  }));

  const lastContentRef = useRef(initialJSON);
  useEffect(() => {
    if (!editor) return;
    if (initialJSON !== lastContentRef.current) {
      lastContentRef.current = initialJSON;
      editor.commands.setContent((initialJSON as any) ?? "", { emitUpdate: false });
    }
  }, [initialJSON, editor]);

  if (!editor) return null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <button onClick={() => editor.chain().focus().toggleBold().run()} className="px-2 py-1 rounded hover:bg-muted" title="Bold"><Bold className="w-4 h-4" /></button>
        <button onClick={() => editor.chain().focus().toggleItalic().run()} className="px-2 py-1 rounded hover:bg-muted" title="Italic"><Italic className="w-4 h-4" /></button>
        <button onClick={() => editor.chain().focus().toggleUnderline().run()} className="px-2 py-1 rounded hover:bg-muted" title="Underline"><UnderlineIcon className="w-4 h-4" /></button>
        <button onClick={() => editor.chain().focus().toggleStrike().run()} className="px-2 py-1 rounded hover:bg-muted" title="Strikethrough"><span className="text-sm font-semibold">S</span></button>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className="px-2 py-1 rounded hover:bg-muted" title="H1"><Type className="w-4 h-4" /></button>
        <button onClick={() => editor.chain().focus().toggleBulletList().run()} className="px-2 py-1 rounded hover:bg-muted" title="Bullet list"><List className="w-4 h-4" /></button>
        <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className="px-2 py-1 rounded hover:bg-muted" title="Numbered list"><ListOrdered className="w-4 h-4" /></button>
        <button onClick={() => editor.chain().focus().toggleTaskList().run()} className="px-2 py-1 rounded hover:bg-muted" title="Checklist"><CheckSquare className="w-4 h-4" /></button>
        <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className="px-2 py-1 rounded hover:bg-muted" title="Quote"><Quote className="w-4 h-4" /></button>
        <button onClick={() => editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run()} className="px-2 py-1 rounded hover:bg-muted" title="Insert table"><TableIcon className="w-4 h-4" /></button>
        <button onClick={() => { fileRef.current?.click(); }} className="px-2 py-1 rounded hover:bg-muted" title="Insert image"><ImageIcon className="w-4 h-4" /></button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { const fr = new FileReader(); fr.onload = () => { const url = fr.result as string; editor.chain().focus().setImage({ src: url }).run(); }; fr.readAsDataURL(f); e.currentTarget.value = ""; } }} />
        <button onClick={() => editor.chain().focus().setHorizontalRule().run()} className="px-2 py-1 rounded hover:bg-muted" title="Divider">—</button>
        <button onClick={() => editor.chain().focus().toggleHighlight({ color: "urgent" }).run()} className="px-2 py-1 rounded hover:bg-muted text-destructive" title="Urgent highlight">!</button>
        <button onClick={() => editor.chain().focus().extendMarkRange("link").run()} className="px-2 py-1 rounded hover:bg-muted" title="Link"><LinkIcon className="w-4 h-4" /></button>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
});

export default RichTextEditor;
