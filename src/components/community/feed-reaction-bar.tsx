"use client";

import { useActionState } from "react";
import { FORUM_EMOJIS } from "@/lib/forum";
import { cn } from "@/lib/utils";
import {
  reactToFeedPost,
  type CommunityActionState,
} from "@/server/actions/feed";

export function FeedReactionBar({
  postId,
  counts,
  mine,
  canReact,
}: {
  postId: string;
  counts: Record<string, number>;
  mine: string[];
  canReact: boolean;
}) {
  const [state, action, pending] = useActionState<
    CommunityActionState,
    FormData
  >(reactToFeedPost, null);

  if (!canReact && Object.values(counts).every((n) => !n)) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-1.5">
      {FORUM_EMOJIS.map((emoji) => {
        const count = counts[emoji] ?? 0;
        const selected = mine.includes(emoji);
        const className = cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm",
          selected
            ? "border-primary bg-accent text-foreground"
            : "border-border bg-background text-foreground hover:bg-muted",
        );

        if (!canReact) {
          return count > 0 ? (
            <span key={emoji} className={className}>
              <span aria-hidden>{emoji}</span>
              <span className="text-xs tabular-nums">{count}</span>
            </span>
          ) : null;
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
              {count > 0 ? (
                <span className="text-xs tabular-nums">{count}</span>
              ) : null}
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
