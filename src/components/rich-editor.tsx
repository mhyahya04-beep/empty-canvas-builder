import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { 
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered, 
  Quote, Heading1, Heading2, Heading3, CheckSquare, Minus, Link as LinkIcon, 
  Table as TableIcon, Plus, Trash2, AlignLeft, AlignRight, Image as ImageIcon,
  Highlighter
} from "lucide-react";
import { cn } from "@/lib/utils";

export const RichTextEditor = forwardRef(({
  initialJSON, onChange, placeholder = "Write notes, thoughts, ingredients, anything…",
}: {
  initialJSON: unknown;
  onChange: (json: unknown) => void;
  placeholder?: string;
}, ref) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener", target: "_blank" } }),
      Image,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
      Underline,
      Highlight.configure({ multicolor: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: (initialJSON as any) ?? "",
    editorProps: {
      attributes: { class: "tiptap-doc focus:outline-none" },
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });

  useImperativeHandle(ref, () => ({
    insertImage: (url: string) => {
      editor?.chain().focus().setImage({ src: url }).run();
    }
  }));

  // load new content when record changes
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
    <div className="relative">
      <div className="flex items-center flex-wrap gap-0.5 mb-2 sticky top-0 bg-card/95 backdrop-blur z-10 py-1 -mx-1 px-1 border-b border-border/50">
        <Btn active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1"><Heading1 className="w-4 h-4" /></Btn>
        <Btn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2"><Heading2 className="w-4 h-4" /></Btn>
        <Btn active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3"><Heading3 className="w-4 h-4" /></Btn>
        <Sep />
        <Btn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold"><Bold className="w-4 h-4" /></Btn>
        <Btn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic"><Italic className="w-4 h-4" /></Btn>
        <Btn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline"><UnderlineIcon className="w-4 h-4" /></Btn>
        <Btn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strike"><Strikethrough className="w-4 h-4" /></Btn>
        <Btn active={editor.isActive("highlight", { color: "urgent" })} onClick={() => editor.chain().focus().toggleHighlight({ color: "urgent" }).run()} title="Urgent Highlight"><Highlighter className="w-4 h-4 text-rose-500" /></Btn>
        <Sep />
        <Btn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list"><List className="w-4 h-4" /></Btn>
        <Btn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list"><ListOrdered className="w-4 h-4" /></Btn>
        <Btn active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()} title="Task list"><CheckSquare className="w-4 h-4" /></Btn>
        <Btn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Quote"><Quote className="w-4 h-4" /></Btn>
        <Sep />
        <Btn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert Table"><TableIcon className="w-4 h-4" /></Btn>
        <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider"><Minus className="w-4 h-4" /></Btn>
        <Btn active={editor.isActive("link")} onClick={() => {
          const url = prompt("Link URL:", editor.getAttributes("link").href ?? "https://");
          if (url === null) return;
          if (url === "") editor.chain().focus().unsetLink().run();
          else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
        }} title="Link"><LinkIcon className="w-4 h-4" /></Btn>
        <Btn onClick={() => {
          const url = prompt("Image URL:", "https://");
          if (url) editor.chain().focus().setImage({ src: url }).run();
        }} title="Image"><ImageIcon className="w-4 h-4" /></Btn>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
});

RichTextEditor.displayName = "RichTextEditor";

function Btn({ children, onClick, active, title }: { children: React.ReactNode; onClick: () => void; active?: boolean; title?: string }) {
  return (
    <button type="button" onClick={onClick} title={title}
      className={cn("p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors",
        active && "bg-muted text-foreground")}>{children}</button>
  );
}
function Sep() { return <div className="w-px h-5 bg-border mx-1" />; }
