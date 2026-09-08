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
  createFeedPost,
  type CommunityActionState,
} from "@/server/actions/feed";

export function FeedComposer() {
  const [state, action, pending] = useActionState<
    CommunityActionState,
    FormData
  >(createFeedPost, null);

  return (
    <form action={action} className="grid gap-3 rounded-xl border border-border bg-card p-5">
      <label className="text-sm font-medium text-foreground">
        Share with educators
        <textarea
          className={`${fieldClass} min-h-24`}
          name="body"
          rows={4}
          maxLength={MAX_FEED_BODY}
          required
          placeholder="Share a thought, a classroom note, or a question."
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
