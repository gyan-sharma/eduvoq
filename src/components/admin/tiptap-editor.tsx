"use client";

import { useState } from "react";
import LinkExtension from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import { emptyDoc, parseTipTapDoc } from "@/content/tiptap";

function toolbarClass(active: boolean): string {
  return active
    ? "rounded-md bg-emerald-800 px-2 py-1 text-xs font-medium text-white"
    : "rounded-md border border-stone-300 bg-white px-2 py-1 text-xs font-medium text-stone-800 hover:bg-stone-50";
}

export function TiptapEditor({
  name,
  initial,
  placeholder = "Write…",
}: {
  name: string;
  initial: unknown;
  placeholder?: string;
}) {
  const doc = parseTipTapDoc(initial) ?? emptyDoc;
  const [json, setJson] = useState(() => JSON.stringify(doc));
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: false,
      }),
      LinkExtension.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: doc,
    editorProps: {
      attributes: {
        class:
          "min-h-64 px-3 py-2 text-sm leading-6 text-stone-900 focus:outline-none",
      },
    },
    onUpdate: ({ editor: instance }) => {
      setJson(JSON.stringify(instance.getJSON()));
    },
  });

  return (
    <div className="overflow-hidden rounded-md border border-stone-300 bg-white">
      <input type="hidden" name={name} value={json} />
      <div className="flex flex-wrap gap-1 border-b border-stone-200 bg-stone-50 p-2">
        <button
          type="button"
          className={toolbarClass(editor?.isActive("bold") ?? false)}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          Bold
        </button>
        <button
          type="button"
          className={toolbarClass(editor?.isActive("italic") ?? false)}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          Italic
        </button>
        <button
          type="button"
          className={toolbarClass(editor?.isActive("heading", { level: 2 }) ?? false)}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </button>
        <button
          type="button"
          className={toolbarClass(editor?.isActive("heading", { level: 3 }) ?? false)}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </button>
        <button
          type="button"
          className={toolbarClass(editor?.isActive("bulletList") ?? false)}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          List
        </button>
        <button
          type="button"
          className={toolbarClass(editor?.isActive("orderedList") ?? false)}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          Numbered
        </button>
        <button
          type="button"
          className={toolbarClass(editor?.isActive("link") ?? false)}
          onClick={() => {
            if (!editor) return;
            if (editor.isActive("link")) {
              editor.chain().focus().unsetLink().run();
              return;
            }
            const href = window.prompt("Link URL");
            if (!href) return;
            editor.chain().focus().setLink({ href }).run();
          }}
        >
          Link
        </button>
      </div>
      <EditorContent editor={editor} className="tiptap-editor" />
    </div>
  );
}
