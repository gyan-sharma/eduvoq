import Link from "next/link";

import { DemoBanner } from "@/components/demo/demo-banner";
import { MemberCard } from "@/components/members/member-card";
import { DEMO_MEMBERS } from "@/lib/demo-content";
import {
  BOARD_LABELS,
  ROLE_LABELS,
  type PublicMemberCard,
} from "@/lib/profile-privacy";

export function DemoMembersIndex() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <DemoBanner surface="members directory" />
      <p className="mt-6 text-sm font-medium tracking-wide text-primary uppercase">
        Community
      </p>
      <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">
        Educators
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Sample public directory. Student accounts are never listed.
      </p>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DEMO_MEMBERS.map((member) => (
          <li key={member.id}>
            <MemberCard member={member} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DemoMemberProfile({ member }: { member: PublicMemberCard }) {
  const place = [member.city, member.state].filter(Boolean).join(", ");
  const board = member.boardAffiliation
    ? BOARD_LABELS[member.boardAffiliation]
    : null;

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <DemoBanner surface="member profile" />
      <p className="mt-6 text-sm text-muted-foreground">
        <Link href="/members" className="text-primary hover:underline">
          ← Educators
        </Link>
      </p>
      <header className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
        <span
          aria-hidden
          className="flex size-20 items-center justify-center rounded-full bg-primary font-heading text-2xl font-semibold text-primary-foreground"
        >
          {member.displayName.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-wide text-primary uppercase">
            {ROLE_LABELS[member.role]}
          </p>
          <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">
            {member.displayName}
          </h1>
          <p className="mt-1 text-muted-foreground">@{member.username}</p>
          {member.headline ? (
            <p className="mt-3 text-foreground">{member.headline}</p>
          ) : null}
          {place || board ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {[place, board].filter(Boolean).join(" · ")}
            </p>
          ) : null}
          <p className="mt-3 text-sm text-muted-foreground">
            48 followers · 12 following · Joined August 2026
          </p>
        </div>
      </header>
      <div className="mt-8 grid gap-6">
        {member.bio ? (
          <section>
            <h2 className="font-heading text-lg font-semibold">About</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {member.bio}
            </p>
          </section>
        ) : null}
        {member.schoolName ? (
          <p className="text-sm text-muted-foreground">
            School: {member.schoolName}
          </p>
        ) : null}
        {member.subjects.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Subjects: {member.subjects.join(", ")}
          </p>
        ) : null}
        {member.classesTaught.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Classes: {member.classesTaught.join(", ")}
          </p>
        ) : null}
      </div>
    </article>
  );
}
