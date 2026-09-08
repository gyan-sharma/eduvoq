"use client";

import { useActionState } from "react";
import Link from "next/link";
import { react, type ForumActionState } from "@/server/actions/forum";
import { FORUM_EMOJIS } from "@/lib/forum";
import { cn } from "@/lib/utils";

export function ReactionBar({
  postId,
  counts,
  mine,
  canPost,
  loginHref,
}: {
  postId: string;
  counts: Record<string, number>;
  mine: string[];
  canPost: boolean;
  loginHref: string;
}) {
  const [state, action, pending] = useActionState<ForumActionState, FormData>(
    react,
    null,
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {FORUM_EMOJIS.map((emoji) => {
        const count = counts[emoji] ?? 0;
        const selected = mine.includes(emoji);
        const className = cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm",
          selected
            ? "border-primary bg-accent text-foreground"
            : "border-border bg-background text-foreground hover:bg-muted",
        );

        if (!canPost) {
          return (
            <Link key={emoji} href={loginHref} className={className}>
              <span aria-hidden>{emoji}</span>
              {count > 0 ? <span className="text-xs tabular-nums">{count}</span> : null}
            </Link>
          );
        }

        return (
          <form action={action} key={emoji}>
            <input type="hidden" name="postId" value={postId} />
            <input type="hidden" name="emoji" value={emoji} />
            <button
              type="submit"
              disabled={pending}
              className={className}
              aria-pressed={selected}
              aria-label={`React ${emoji}`}
            >
              <span aria-hidden>{emoji}</span>
              {count > 0 ? <span className="text-xs tabular-nums">{count}</span> : null}
            </button>
          </form>
        );
      })}
      {state?.error ? (
        <p className="text-xs text-red-800">{state.error}</p>
      ) : null}
    </div>
  );
}
