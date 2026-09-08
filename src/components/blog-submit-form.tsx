"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  submitBlog,
  type BlogSubmitState,
} from "@/server/actions/blog";

export function BlogSubmitForm() {
  const [state, formAction, pending] = useActionState<
    BlogSubmitState,
    FormData
  >(submitBlog, null);

  if (state?.ok) {
    return (
      <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm leading-6">
        {state.message ??
          "Thanks — your post is in review and is not public yet."}
      </p>
    );
  }

  return (
    <form action={formAction} className="relative flex max-w-xl flex-col gap-4">
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden>
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          required
          minLength={8}
          maxLength={255}
          aria-invalid={state?.fieldErrors?.title ? true : undefined}
        />
        {state?.fieldErrors?.title ? (
          <p className="text-sm text-destructive">{state.fieldErrors.title}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="excerpt">Excerpt (optional)</Label>
        <Textarea
          id="excerpt"
          name="excerpt"
          maxLength={2000}
          rows={3}
          aria-invalid={state?.fieldErrors?.excerpt ? true : undefined}
        />
        {state?.fieldErrors?.excerpt ? (
          <p className="text-sm text-destructive">
            {state.fieldErrors.excerpt}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="body">Article</Label>
        <Textarea
          id="body"
          name="body"
          required
          minLength={40}
          maxLength={20000}
          rows={12}
          aria-invalid={state?.fieldErrors?.body ? true : undefined}
        />
        {state?.fieldErrors?.body ? (
          <p className="text-sm text-destructive">{state.fieldErrors.body}</p>
        ) : null}
      </div>

      {state?.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Submitting…" : "Submit for review"}
      </Button>
    </form>
  );
}
