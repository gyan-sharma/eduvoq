"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  draftBlogPost,
  type BlogDraftAssistState,
} from "@/server/actions/ai";

export function BlogDraftHelper({
  onApply,
}: {
  onApply: (draft: { title: string; excerpt: string; body: string }) => void;
}) {
  const [state, formAction, pending] = useActionState<
    BlogDraftAssistState,
    FormData
  >(draftBlogPost, null);

  return (
    <section className="mb-8 max-w-xl rounded-xl border border-border bg-card p-6">
      <h2 className="font-heading text-lg font-semibold">Draft with AI</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        Optional helper. Do not paste student names, emails, or phone numbers.
        You still submit the article for staff review.
      </p>

      <form action={formAction} className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="ai-topic">Topic</Label>
          <Input
            id="ai-topic"
            name="topic"
            required
            minLength={8}
            maxLength={500}
            placeholder="e.g. Mastering the art of lesson planning"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ai-audience">Audience (optional)</Label>
          <Input
            id="ai-audience"
            name="audience"
            maxLength={200}
            placeholder="School teachers, CBSE middle school"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ai-notes">Notes / outline (optional)</Label>
          <Textarea id="ai-notes" name="notes" maxLength={4000} rows={4} />
        </div>

        {state?.error ? (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" disabled={pending} variant="outline" className="self-start">
          {pending ? "Drafting…" : "Generate draft"}
        </Button>
      </form>

      {state?.ok && state.title && state.body ? (
        <div className="mt-4 rounded-lg border border-border bg-muted/40 p-4">
          <p className="text-sm font-medium">{state.title}</p>
          {state.excerpt ? (
            <p className="mt-1 text-sm text-muted-foreground">{state.excerpt}</p>
          ) : null}
          <Button
            type="button"
            className="mt-3"
            onClick={() =>
              onApply({
                title: state.title ?? "",
                excerpt: state.excerpt ?? "",
                body: state.body ?? "",
              })
            }
          >
            Use this draft
          </Button>
        </div>
      ) : null}
    </section>
  );
}
