"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  replyThread,
  type ForumActionState,
} from "@/server/actions/forum";
import {
  buttonClass,
  errorClass,
  fieldClass,
  successClass,
} from "@/components/auth/ui";
import { FORUM_BODY_MAX } from "@/lib/forum";

export function ReplyForm({
  categorySlug,
  threadSlug,
  parentId,
  signedIn,
  canPost,
  locked,
  compact,
}: {
  categorySlug: string;
  threadSlug: string;
  parentId?: string | null;
  signedIn: boolean;
  canPost: boolean;
  locked: boolean;
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState<ForumActionState, FormData>(
    replyThread,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const callbackUrl = `/forum/${categorySlug}/${threadSlug}`;

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  if (locked) {
    return compact ? null : (
      <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
        This thread is locked.
      </p>
    );
  }

  if (!canPost) {
    if (compact) return null;
    if (signedIn) {
      return (
        <p className="rounded-xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
          <Link
            href="/complete-profile"
            className="font-medium text-primary hover:underline"
          >
            Finish your profile
          </Link>{" "}
          to reply.
        </p>
      );
    }
    return (
      <p className="rounded-xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
        <Link
          href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="font-medium text-primary hover:underline"
        >
          Log in
        </Link>{" "}
        to reply.
      </p>
    );
  }

  const form = (
    <form ref={formRef} action={action} className="grid gap-3">
      <input type="hidden" name="categorySlug" value={categorySlug} />
      <input type="hidden" name="threadSlug" value={threadSlug} />
      {parentId ? <input type="hidden" name="parentId" value={parentId} /> : null}
      {state?.error ? <p className={errorClass}>{state.error}</p> : null}
      {state?.ok ? <p className={successClass}>{state.message ?? "Posted."}</p> : null}
      <label className="block text-sm font-medium text-stone-700">
        {parentId ? "Reply" : "Add a reply"}
        <textarea
          className={`${fieldClass} min-h-24`}
          name="body"
          maxLength={FORUM_BODY_MAX}
          required
        />
      </label>
      <button
        className={`${buttonClass} w-auto justify-self-start`}
        type="submit"
        disabled={pending}
      >
        {pending ? "Posting…" : parentId ? "Reply" : "Post reply"}
      </button>
    </form>
  );

  if (compact) {
    return (
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium text-primary">
          Reply
        </summary>
        <div className="mt-3">{form}</div>
      </details>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">{form}</div>
  );
}
