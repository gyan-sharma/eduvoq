import Link from "next/link";
import type { ForumAuthorView } from "@/lib/forum";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

export function AuthorByline({
  author,
  when,
}: {
  author: ForumAuthorView;
  when?: string;
}) {
  const avatar = author.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={author.avatarUrl}
      alt=""
      className="size-8 rounded-full object-cover"
    />
  ) : (
    <span
      aria-hidden
      className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
    >
      {initials(author.displayName)}
    </span>
  );

  const name = author.href ? (
    <Link href={author.href} className="font-medium text-foreground hover:underline">
      {author.displayName}
    </Link>
  ) : (
    <span className="font-medium text-foreground">{author.displayName}</span>
  );

  return (
    <div className="flex items-center gap-2 text-sm">
      {avatar}
      <div className="min-w-0">
        {name}
        {when ? (
          <p className="text-xs text-muted-foreground">{when}</p>
        ) : null}
      </div>
    </div>
  );
}
