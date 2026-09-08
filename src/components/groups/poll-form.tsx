"use client";

import { useActionState } from "react";
import {
  buttonClass,
  errorClass,
  fieldClass,
  successClass,
} from "@/components/auth/ui";
import { createPoll, type GroupActionState } from "@/server/actions/groups";

export function PollForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState<GroupActionState, FormData>(
    createPoll,
    null,
  );

  return (
    <form action={action} className="grid gap-3 rounded-xl border border-dashed border-border bg-card p-5">
      <input type="hidden" name="slug" value={slug} />
      <p className="text-sm font-medium text-foreground">Create a poll</p>
      <label className="text-sm font-medium text-foreground">
        Question
        <input
          className={fieldClass}
          name="question"
          maxLength={280}
          required
          placeholder="Which board workshop should we run next?"
        />
      </label>
      <label className="text-sm font-medium text-foreground">
        Options (one per line)
        <textarea
          className={`${fieldClass} min-h-24`}
          name="options"
          rows={4}
          required
          placeholder={"CBSE\nICSE\nIB\nState board"}
        />
      </label>
      {state?.error ? <p className={errorClass}>{state.error}</p> : null}
      {state?.ok && state.message ? (
        <p className={successClass}>{state.message}</p>
      ) : null}
      <div className="flex justify-end">
        <button
          className={`${buttonClass} w-auto`}
          type="submit"
          disabled={pending}
        >
          {pending ? "Posting poll…" : "Post poll"}
        </button>
      </div>
    </form>
  );
}
