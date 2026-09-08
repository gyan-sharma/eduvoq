import Link from "next/link";
import type { ForumAuthorView } from "@/lib/forum";

export function ThreadRow({
  href,
  title,
  excerpt,
  author,
  when,
  replyCount,
  pinned,
  locked,
  category,
}: {
  href: string;
  title: string;
  excerpt?: string;
  author: ForumAuthorView;
  when: string;
  replyCount: number;
  pinned?: boolean;
  locked?: boolean;
  category?: { href: string; name: string };
}) {
  const replies = Math.max(0, replyCount - 1);
  return (
    <article className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs font-medium tracking-wide uppercase">
        {pinned ? <span className="text-primary">Pinned</span> : null}
        {locked ? <span className="text-muted-foreground">Locked</span> : null}
        {category ? (
          <Link href={category.href} className="text-primary hover:underline">
            {category.name}
          </Link>
        ) : null}
      </div>
      <h2 className="mt-1 font-heading text-lg font-semibold tracking-tight">
        <Link href={href} className="hover:underline">
          {title}
        </Link>
      </h2>
      {excerpt ? (
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{excerpt}</p>
      ) : null}
      <p className="mt-3 text-sm text-muted-foreground">
        {author.displayName} · {when} · {replies}{" "}
        {replies === 1 ? "reply" : "replies"}
      </p>
    </article>
  );
}
