import Link from "next/link";
import type { PublicMemberCard } from "@/lib/profile-privacy";
import { BOARD_LABELS, ROLE_LABELS } from "@/lib/profile-privacy";

function location(card: PublicMemberCard): string | null {
  const parts = [card.city, card.state].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

export function MemberCard({ member }: { member: PublicMemberCard }) {
  const place = location(member);
  const board = member.boardAffiliation
    ? BOARD_LABELS[member.boardAffiliation]
    : null;

  return (
    <article className="flex h-full flex-col rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        {member.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={member.avatarUrl}
            alt=""
            className="size-12 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex size-12 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
          >
            {initials(member.displayName)}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="truncate font-heading text-lg font-semibold tracking-tight">
            <Link
              href={`/members/${member.username}`}
              className="hover:underline"
            >
              {member.displayName}
            </Link>
          </h2>
          <p className="text-sm text-muted-foreground">@{member.username}</p>
        </div>
      </div>
      <p className="mt-3 text-xs font-medium tracking-wide text-primary uppercase">
        {ROLE_LABELS[member.role]}
      </p>
      {member.headline ? (
        <p className="mt-2 line-clamp-2 text-sm text-foreground">
          {member.headline}
        </p>
      ) : null}
      {place || board ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {[place, board].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      <p className="mt-auto pt-4 text-sm">
        <Link
          href={`/members/${member.username}`}
          className="font-medium text-primary hover:underline"
        >
          View profile
        </Link>
      </p>
    </article>
  );
}
