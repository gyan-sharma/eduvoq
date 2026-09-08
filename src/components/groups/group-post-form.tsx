"use client";

import { useActionState } from "react";
import {
  buttonClass,
  errorClass,
  fieldClass,
  successClass,
} from "@/components/auth/ui";
import { MAX_FEED_BODY } from "@/lib/community";
import {
  createGroupPost,
  type GroupActionState,
} from "@/server/actions/groups";

export function GroupPostForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState<GroupActionState, FormData>(
    createGroupPost,
    null,
  );

  return (
    <form action={action} className="grid gap-3 rounded-xl border border-border bg-card p-5">
      <input type="hidden" name="slug" value={slug} />
      <label className="text-sm font-medium text-foreground">
        Start a discussion
        <textarea
          className={`${fieldClass} min-h-24`}
          name="body"
          rows={4}
          maxLength={MAX_FEED_BODY}
          required
          placeholder="Share a note with this group."
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
          {pending ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}
