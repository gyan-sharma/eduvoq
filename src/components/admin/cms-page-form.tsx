"use client";

import { useActionState } from "react";

import { TiptapEditor } from "@/components/admin/tiptap-editor";
import {
  buttonClass,
  errorClass,
  fieldClass,
} from "@/components/auth/ui";
import { saveCmsPage, type AdminActionState } from "@/server/actions/admin";

export function CmsPageForm({
  page,
}: {
  page?: {
    id: string;
    slug: string;
    title: string;
    seoTitle: string | null;
    seoDescription: string | null;
    published: boolean;
    bodyJson: unknown;
  };
}) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    saveCmsPage,
    null,
  );

  return (
    <form action={action} className="grid gap-4">
      {page ? <input type="hidden" name="id" value={page.id} /> : null}
      <label className="block text-sm font-medium text-stone-700">
        Slug
        <input
          className={fieldClass}
          name="slug"
          defaultValue={page?.slug ?? ""}
          required
          placeholder="about or services/marketing"
        />
      </label>
      <label className="block text-sm font-medium text-stone-700">
        Title
        <input
          className={fieldClass}
          name="title"
          defaultValue={page?.title ?? ""}
          required
        />
      </label>
      <label className="block text-sm font-medium text-stone-700">
        SEO title
        <input
          className={fieldClass}
          name="seoTitle"
          defaultValue={page?.seoTitle ?? ""}
        />
      </label>
      <label className="block text-sm font-medium text-stone-700">
        SEO description
        <textarea
          className={fieldClass}
          name="seoDescription"
          rows={2}
          defaultValue={page?.seoDescription ?? ""}
        />
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
        <input
          type="checkbox"
          name="published"
          defaultChecked={page?.published ?? true}
        />
        Published
      </label>
      <div>
        <p className="mb-1 text-sm font-medium text-stone-700">Body</p>
        <TiptapEditor
          name="bodyJson"
          initial={page?.bodyJson}
          placeholder="Page copy…"
        />
      </div>
      {state?.error ? <p className={errorClass}>{state.error}</p> : null}
      <button className={`${buttonClass} w-auto`} type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save page"}
      </button>
    </form>
  );
}
