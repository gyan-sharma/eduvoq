"use client";

import { useActionState } from "react";
import {
  buttonClass,
  errorClass,
  fieldClass,
  successClass,
} from "@/components/auth/ui";
import { MAX_COMMENT_BODY } from "@/lib/community";
import {
  createComment,
  type CommunityActionState,
} from "@/server/actions/feed";

export function CommentForm({ feedPostId }: { feedPostId: string }) {
  const [state, action, pending] = useActionState<
    CommunityActionState,
    FormData
  >(createComment, null);

  return (
    <form action={action} className="mt-4 grid gap-2">
      <input type="hidden" name="feedPostId" value={feedPostId} />
      <label className="sr-only" htmlFor={`comment-${feedPostId}`}>
        Comment
      </label>
      <textarea
        id={`comment-${feedPostId}`}
        className={`${fieldClass} min-h-16`}
        name="body"
        rows={2}
        maxLength={MAX_COMMENT_BODY}
        required
        placeholder="Write a comment"
      />
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
          {pending ? "Sending…" : "Comment"}
        </button>
      </div>
    </form>
  );
}
