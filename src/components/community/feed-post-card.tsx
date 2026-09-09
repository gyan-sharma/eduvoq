import Link from "next/link";
import { AuthorChip } from "@/components/community/author-chip";
import { BodyText } from "@/components/community/body-text";
import { CommentForm } from "@/components/community/comment-form";
import { FeedReactionBar } from "@/components/community/feed-reaction-bar";
import {
  FEED_COMMENT_FOCUS,
  feedPostHref,
  formatCommunityWhen,
} from "@/lib/community";
import { cn } from "@/lib/utils";

export type FeedComment = {
  id: string;
  body: string;
  createdAt: Date;
  author: {
    name: string | null;
    username: string | null;
  };
};

export function FeedPostCard({
  post,
  comments,
  commentCount,
  canComment,
  highlighted = false,
  focused = false,
  reactionCounts = {},
  myReactions = [],
  canReact = false,
}: {
  post: {
    id: string;
    bodyJson: unknown;
    createdAt: Date;
    author: {
      name: string | null;
      username: string | null;
      image: string | null;
    };
  };
  comments: FeedComment[];
  commentCount: number;
  canComment: boolean;
  highlighted?: boolean;
  focused?: boolean;
  reactionCounts?: Record<string, number>;
  myReactions?: string[];
  canReact?: boolean;
}) {
  const chronological = [...comments].reverse();
  const hidden = Math.max(0, commentCount - chronological.length);

  return (
    <article
      id={post.id}
      className={cn(
        "rounded-xl border border-border bg-card p-5 shadow-sm",
        highlighted && "ring-2 ring-primary/25",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <AuthorChip
          name={post.author.name}
          username={post.author.username}
          image={post.author.image}
        />
        <time
          className="shrink-0 text-xs text-muted-foreground"
          dateTime={post.createdAt.toISOString()}
        >
          {formatCommunityWhen(post.createdAt)}
        </time>
      </div>
      <div className="mt-4">
        <BodyText value={post.bodyJson} />
      </div>
      <FeedReactionBar
        postId={post.id}
        counts={reactionCounts}
        mine={myReactions}
        canReact={canReact}
      />
      {chronological.length > 0 ? (
        <ul className="mt-5 space-y-3 border-t border-border pt-4">
          {chronological.map((comment) => (
            <li key={comment.id} className="text-sm">
              <p className="font-medium text-foreground">
                {comment.author.username ? (
                  <Link
                    href={`/members/${comment.author.username}`}
                    className="hover:underline"
                  >
                    {comment.author.name?.trim() || comment.author.username}
                  </Link>
                ) : (
                  comment.author.name?.trim() || "Educator"
                )}
                <span className="ml-2 font-normal text-xs text-muted-foreground">
                  {formatCommunityWhen(comment.createdAt)}
                </span>
              </p>
              <p className="mt-1 whitespace-pre-wrap text-foreground/90">
                {comment.body}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      {hidden > 0 ? (
        focused ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Showing the latest {FEED_COMMENT_FOCUS} of {commentCount} comments.
          </p>
        ) : (
          <p className="mt-3 text-sm">
            <Link
              href={feedPostHref(post.id)}
              className="font-medium text-primary hover:underline"
            >
              View all {commentCount} comments
            </Link>
          </p>
        )
      ) : null}
      {canComment ? <CommentForm feedPostId={post.id} /> : null}
    </article>
  );
}
